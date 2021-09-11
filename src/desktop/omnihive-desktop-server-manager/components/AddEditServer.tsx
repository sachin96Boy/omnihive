import { AdminEventType, AdminResponse, IsHelper, ServerStatus } from "@withonevision/omnihive-core-cjs/index";
import ohLightIcon from "@withonevision/omnihive-desktop-core/assets/oh_icon_light.png";
import ohSpinner from "@withonevision/omnihive-desktop-core/assets/spinner.png";
import { FormCommonStyles } from "@withonevision/omnihive-desktop-core/components/FormCommonStyles";
import { ToastError } from "@withonevision/omnihive-desktop-core/components/ToastError";
import { ToastSuccess } from "@withonevision/omnihive-desktop-core/components/ToastSuccess";
import { DesktopConstants } from "@withonevision/omnihive-desktop-core/models/DesktopConstants";
import { RegisteredServerModel } from "@withonevision/omnihive-desktop-core/models/RegisteredServerModel";
import isIp from "is-ip";
import React, { useEffect, useState } from "react";
import socketio from "socket.io-client";
import { useServerManagerStore } from "../stores/ServerManagerStore";

export type AddEditServerProps = {
    editServerLabel?: string;
    mode: "add" | "edit";
};

const registerButtonStyle: string =
    "mx-auto h-10 px-10 text-sm text-white transition-colors duration-150 rounded-lg focus:shadow-md bg-omnihiveOrange hover:bg-omnihiveOrangeHover";

export const AddEditServer: React.FC<AddEditServerProps> = (props): React.ReactElement => {
    let oldServerLabel: string = "";

    if (!IsHelper.isNullOrUndefinedOrEmptyStringOrWhitespace(props.editServerLabel)) {
        oldServerLabel = props.editServerLabel;
    }

    const { addServer, editServer, registeredServers } = useServerManagerStore();

    const [serverLabel, setServerLabel] = useState<string>("");
    const [serverAddress, setServerAddress] = useState<string>("");
    const [adminPassword, setAdminPassword] = useState<string>("");
    const [serverGroupId, setServerGroupId] = useState<string>("");
    const [processing, setProcessing] = useState<boolean>(false);
    const [showToastSuccess, setShowToastSuccess] = useState<boolean>(false);
    const [showToastError, setShowToastError] = useState<boolean>(false);
    const [toastErrorMessage, setToastErrorMessage] = useState<string>("");
    const [labelError, setLabelError] = useState<string>("");
    const [addressError, setAddressError] = useState<string>("");
    const [adminPasswordError, setAdminPasswordError] = useState<string>("");
    const [serverGroupIdError, setServerGroupIdError] = useState<string>("");

    useEffect(() => {
        if (props.mode.toLowerCase() === "edit") {
            const workerServer: RegisteredServerModel | undefined = registeredServers().find(
                (server: RegisteredServerModel) => server.label === props.editServerLabel
            );

            if (IsHelper.isNullOrUndefined(workerServer)) {
                return;
            }

            setServerLabel(workerServer.label);
            setServerAddress(workerServer.address);
            setServerGroupId(workerServer.serverGroupId);
            setAdminPassword(workerServer.adminPassword);
        }
    }, [props.editServerLabel, props.mode, registeredServers]);

    const capitalize = (s: string) => {
        if (!IsHelper.isString(s)) return "";
        return s.charAt(0).toUpperCase() + s.slice(1);
    };

    const checkLabel = (value: string) => {
        if (IsHelper.isEmptyStringOrWhitespace(value)) {
            setLabelError("Server label cannot be blank");
            return;
        }

        if (
            props.mode.toLowerCase() === "add" &&
            registeredServers().filter((server: RegisteredServerModel) => {
                return server.label === value;
            }).length > 0
        ) {
            setLabelError("You already have a server with this label in use");
            return;
        }

        if (
            props.mode.toLowerCase() === "edit" &&
            value !== oldServerLabel &&
            registeredServers().filter((server: RegisteredServerModel) => {
                return server.label === value;
            }).length > 0
        ) {
            setLabelError("You already have a server with this label in use");
            return;
        }

        setLabelError("");
    };

    const checkAddress = (value: string) => {
        try {
            new URL(value);
        } catch {
            if (!isIp(value)) {
                setAddressError("Address must be a valid URL or a valid IP Address");
                return;
            }
        }

        setAddressError("");
    };

    const checkServerGroupId = (value: string) => {
        if (IsHelper.isEmptyStringOrWhitespace(value)) {
            setServerGroupIdError("Server Group ID cannot be blank");
            return;
        }

        setServerGroupIdError("");
    };

    const checkAdminPassword = (value: string) => {
        if (IsHelper.isEmptyStringOrWhitespace(value)) {
            setAdminPasswordError("Admin password cannot be blank");
            return;
        }

        setAdminPasswordError("");
    };

    const disableSubmit = (): boolean => {
        if (processing) {
            return true;
        }

        if (
            IsHelper.isEmptyStringOrWhitespace(serverLabel) ||
            IsHelper.isEmptyStringOrWhitespace(serverAddress) ||
            IsHelper.isEmptyStringOrWhitespace(adminPassword) ||
            IsHelper.isEmptyStringOrWhitespace(serverGroupId)
        ) {
            return true;
        }

        if (
            !IsHelper.isEmptyStringOrWhitespace(labelError) ||
            !IsHelper.isEmptyStringOrWhitespace(addressError) ||
            !IsHelper.isEmptyStringOrWhitespace(adminPasswordError) ||
            !IsHelper.isEmptyStringOrWhitespace(serverGroupIdError)
        ) {
            return true;
        }

        if (props.mode.toLowerCase() === "edit") {
            const workerServer: RegisteredServerModel | undefined = registeredServers().find(
                (server: RegisteredServerModel) => server.label === props.editServerLabel
            );

            if (IsHelper.isNullOrUndefined(workerServer)) {
                return true;
            }

            return (
                workerServer.address == serverAddress &&
                workerServer.adminPassword === adminPassword &&
                workerServer.label === serverLabel &&
                workerServer.serverGroupId === serverGroupId
            );
        }

        return false;
    };

    const hideToast = () => {
        setToastErrorMessage("");
        setShowToastError(false);
        setShowToastSuccess(false);
    };

    const showError = (error: string) => {
        setToastErrorMessage(error);
        setShowToastError(true);
        setShowToastSuccess(false);

        setTimeout(() => {
            hideToast();
        }, DesktopConstants.errorTimeout);
    };

    const showSuccess = () => {
        setToastErrorMessage("");
        setShowToastError(false);
        setShowToastSuccess(true);

        setTimeout(() => {
            hideToast();
        }, DesktopConstants.successTimeout);
    };

    const submit = async () => {
        setProcessing(true);

        const url: URL = new URL(serverAddress);
        const socket = socketio(`${url.origin}/${serverGroupId}`, {
            path: `${url.pathname === "/" ? "" : url.pathname}/socket.io`,
            transports: ["websocket"],
        });

        socket.on("connect", () => {
            socket.emit(AdminEventType.RegisterRequest, {
                adminPassword,
                serverGroupId,
            });
        });

        socket.on("connect_error", () => {
            setProcessing(false);
            showError("Server Cannot Be Contacted");
            socket.disconnect();
        });

        socket.on(AdminEventType.RegisterResponse, (message: AdminResponse<{ verified: boolean }>) => {
            if (message.serverGroupId !== serverGroupId) {
                return;
            }

            socket.disconnect();

            if (
                IsHelper.isNullOrUndefined(message) ||
                !message.requestComplete ||
                IsHelper.isNullOrUndefined(message.data) ||
                !message.data.verified
            ) {
                showError(message.requestError ?? "");
                setProcessing(false);
                return;
            }

            showSuccess();

            setTimeout(() => {
                setProcessing(false);

                const registeredServer: RegisteredServerModel = {
                    address: serverAddress,
                    adminPassword,
                    serverGroupId,
                    label: serverLabel,
                    status: ServerStatus.Unknown,
                    urls: [],
                };

                switch (props.mode) {
                    case "add":
                        addServer(registeredServer);
                        break;
                    case "edit":
                        editServer(oldServerLabel, registeredServer);
                        break;
                }
            }, DesktopConstants.successTimeout);
        });
    };

    return (
        <>
            <ToastSuccess show={showToastSuccess} message={`${capitalize(props.mode)} Server Successful...Saving...`} />
            <ToastError show={showToastError} message={toastErrorMessage} />
            <div className="w-full flex flex-col items-center justify-center">
                <div className="w-1/2 mt-5">
                    <div className="mx-auto py-6">
                        <img className="mx-auto w-20" alt="OmniHive Logo" src={ohLightIcon} />
                    </div>
                    <div className="mx-auto text-center mb-4">
                        <div className="text-white text-3xl">OMNIHIVE</div>
                        {props.mode.toLowerCase() === "add" && (
                            <div className="text-2xl text-omnihiveOrange">ADD SERVER</div>
                        )}
                        {props.mode.toLowerCase() === "edit" && (
                            <div className="text-2xl text-omnihiveOrange">EDIT SERVER</div>
                        )}
                    </div>
                    <div>
                        <div className={FormCommonStyles.InputContainer}>
                            <label className={FormCommonStyles.InputLabel}>Server Label</label>
                            <input
                                className={FormCommonStyles.Input}
                                style={labelError !== "" ? FormCommonStyles.ErrorInputBorder : {}}
                                type="text"
                                name="serverLabel"
                                value={serverLabel}
                                onChange={(e) => {
                                    setServerLabel(e.target.value);
                                    checkLabel(e.target.value);
                                }}
                            />
                            {labelError !== "" && <div className={FormCommonStyles.Error}>{labelError}</div>}
                        </div>
                        <div className={FormCommonStyles.InputContainer}>
                            <label className={FormCommonStyles.InputLabel}>
                                Server Address (Include Protocol and Port Number)
                            </label>
                            <input
                                className={FormCommonStyles.Input}
                                style={addressError !== "" ? FormCommonStyles.ErrorInputBorder : {}}
                                type="text"
                                name="serverAddress"
                                value={serverAddress}
                                onChange={(e) => {
                                    setServerAddress(e.target.value);
                                    checkAddress(e.target.value);
                                }}
                            />
                            {addressError !== "" && <div className={FormCommonStyles.Error}>{addressError}</div>}
                        </div>
                        <div className={FormCommonStyles.InputContainer}>
                            <label className={FormCommonStyles.InputLabel}>Server Group ID</label>
                            <input
                                className={FormCommonStyles.Input}
                                style={serverGroupIdError !== "" ? FormCommonStyles.ErrorInputBorder : {}}
                                type="password"
                                name="serverGroupId"
                                value={serverGroupId}
                                onChange={(e) => {
                                    setServerGroupId(e.target.value);
                                    checkServerGroupId(e.target.value);
                                }}
                            />
                            {serverGroupIdError !== "" && (
                                <div className={FormCommonStyles.Error}>{serverGroupIdError}</div>
                            )}
                        </div>
                        <div className={FormCommonStyles.InputContainer}>
                            <label className={FormCommonStyles.InputLabel}>Admin Password</label>
                            <input
                                className={FormCommonStyles.Input}
                                style={adminPasswordError !== "" ? FormCommonStyles.ErrorInputBorder : {}}
                                type="password"
                                name="adminPassword"
                                value={adminPassword}
                                onChange={(e) => {
                                    setAdminPassword(e.target.value);
                                    checkAdminPassword(e.target.value);
                                }}
                            />
                            {adminPasswordError !== "" && (
                                <div className={FormCommonStyles.Error}>{adminPasswordError}</div>
                            )}
                        </div>
                        <div className="content-center mx-auto text-center pt-4">
                            {disableSubmit() && !processing && (
                                <button
                                    disabled={true}
                                    className={`${registerButtonStyle} cursor-not-allowed disabled:opacity-50`}
                                >
                                    {props.mode.toLowerCase() === "add" && <span>Register</span>}
                                    {props.mode.toLowerCase() === "edit" && <span>Edit</span>}
                                </button>
                            )}
                            {!disableSubmit() && !processing && (
                                <button onClick={submit} className={registerButtonStyle}>
                                    {props.mode.toLowerCase() === "add" && <span>Register</span>}
                                    {props.mode.toLowerCase() === "edit" && <span>Edit</span>}
                                </button>
                            )}
                            {processing && (
                                <button disabled={true} className={registerButtonStyle}>
                                    <img src={ohSpinner} alt="spinner" className="h-3 animate-spin" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
