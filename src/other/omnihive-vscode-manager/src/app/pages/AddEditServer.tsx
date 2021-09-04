import { AdminEventType } from "@withonevision/omnihive-core/enums/AdminEventType";
import { ServerStatus } from "@withonevision/omnihive-core/enums/ServerStatus";
import { IsHelper } from "@withonevision/omnihive-core/helpers/IsHelper";
import { AdminResponse } from "@withonevision/omnihive-core/models/AdminResponse";
import isIp from "is-ip";
import React from "react";
import socketio from "socket.io-client";
import { VsCodeCommand } from "../../enums/VsCodeCommand";
import { ReactPropsModel } from "../../models/ReactPropsModel";
import { RegisteredServerModel } from "../../models/RegisteredServerModel";
import { VsCodePostMessageModel } from "../../models/VsCodePostMessageModel";
import { FormStyles } from "../common/CommonStyles";
import { ToastError } from "../components/ToastError";
import { ToastSuccess } from "../components/ToastSuccess";

type Props = {
    props: ReactPropsModel;
};

export const AddEditServer: React.FC<Props> = ({ props }): React.ReactElement => {
    const oldServerLabel = props.panelData.editServerLabel;

    const [serverLabel, setServerLabel] = React.useState<string>("");
    const [serverAddress, setServerAddress] = React.useState<string>("");
    const [adminPassword, setAdminPassword] = React.useState<string>("");
    const [serverGroupId, setServerGroupId] = React.useState<string>("");
    const [processing, setProcessing] = React.useState<boolean>(false);
    const [showToastSuccess, setShowToastSuccess] = React.useState<boolean>(false);
    const [showToastError, setShowToastError] = React.useState<boolean>(false);
    const [toastErrorMessage, setToastErrorMessage] = React.useState<string>("");
    const [labelError, setLabelError] = React.useState<string>("");
    const [addressError, setAddressError] = React.useState<string>("");
    const [adminPasswordError, setAdminPasswordError] = React.useState<string>("");
    const [serverGroupIdError, setServerGroupIdError] = React.useState<string>("");

    React.useEffect(() => {
        if (props.panelData.mode.toLowerCase() === "edit") {
            const workerServer: RegisteredServerModel | undefined = props.registeredServers.find(
                (server: RegisteredServerModel) => server.label === props.panelData.editServerLabel
            );

            if (IsHelper.isNullOrUndefined(workerServer)) {
                return;
            }

            setServerLabel(workerServer.label);
            setServerAddress(workerServer.address);
            setServerGroupId(workerServer.serverGroupId);
            setAdminPassword(workerServer.adminPassword);
        }
    }, []);

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
            props.panelData.mode.toLowerCase() === "add" &&
            props.registeredServers.filter((server: RegisteredServerModel) => {
                return server.label === value;
            }).length > 0
        ) {
            setLabelError("You already have a server with this label in use");
            return;
        }

        if (
            props.panelData.mode.toLowerCase() === "edit" &&
            value !== oldServerLabel &&
            props.registeredServers.filter((server: RegisteredServerModel) => {
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

        if (props.panelData.mode.toLowerCase() === "edit") {
            const workerServer: RegisteredServerModel | undefined = props.registeredServers.find(
                (server: RegisteredServerModel) => server.label === props.panelData.editServerLabel
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
        }, props.extensionConfiguration.generalAlertErrorTimeout);
    };

    const showSuccess = () => {
        setToastErrorMessage("");
        setShowToastError(false);
        setShowToastSuccess(true);

        setTimeout(() => {
            hideToast();
        }, props.extensionConfiguration.generalAlertSuccessTimeout);
    };

    const submit = async () => {
        setProcessing(true);

        let serverModel: RegisteredServerModel = {
            adminPassword,
            serverGroupId: serverGroupId,
            label: serverLabel,
            address: serverAddress,
            status: ServerStatus.Unknown,
            urls: [],
        };

        const url: URL = new URL(serverAddress);
        const socket = socketio(`${url.origin}/${serverGroupId}`, {
            path: `${url.pathname === "/" ? "" : url.pathname}/socket.io`,
            transports: ["websocket"],
        });

        socket.on("connect", () => {
            socket.emit(AdminEventType.RegisterRequest, {
                adminPassword: serverModel.adminPassword,
                serverGroupId: serverModel.serverGroupId,
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
                showError(message.requestError);
                setProcessing(false);
                return;
            }

            showSuccess();

            setTimeout(() => {
                setProcessing(false);
                const postMessage: VsCodePostMessageModel = {
                    command: props.panelData.mode === "add" ? VsCodeCommand.AddServer : VsCodeCommand.EditServer,
                    data: {
                        oldServerLabel: oldServerLabel,
                        registeredServer: {
                            address: serverAddress,
                            adminPassword,
                            serverGroupId,
                            label: serverLabel,
                            status: ServerStatus.Unknown,
                            urls: [],
                        },
                    },
                };

                props.vscode.postMessage(postMessage);
            }, props.extensionConfiguration.generalAlertSuccessTimeout);
        });
    };

    return (
        <>
            <ToastSuccess
                show={showToastSuccess}
                message={`${capitalize(props.panelData.mode)} Server Successful...Saving...`}
                successPng={props.imageSources.success}
            />
            <ToastError show={showToastError} message={toastErrorMessage} errorPng={props.imageSources.error} />
            <div className="w-full h-full flex flex-col items-center overflow-auto">
                <div className="w-1/2 mb-10">
                    <div className="mx-auto py-6">
                        <img
                            className="mx-auto"
                            alt="OmniHive Logo"
                            src={props.imageSources.beeLight}
                            style={{ width: 125 }}
                        />
                    </div>
                    <div className="mx-auto text-center pb-6">
                        <div className="text-white text-3xl">OMNIHIVE</div>
                        {props.panelData.mode.toLowerCase() === "add" && (
                            <div className="text-2xl text-omnihive-orange">ADD SERVER</div>
                        )}
                        {props.panelData.mode.toLowerCase() === "edit" && (
                            <div className="text-2xl text-omnihive-orange">EDIT SERVER</div>
                        )}
                    </div>
                    <div>
                        <div className={FormStyles.formInputContainer}>
                            <label className={FormStyles.formInputLabel}>Server Label</label>
                            <input
                                className={FormStyles.formInput}
                                style={labelError !== "" ? { border: "2px solid red" } : {}}
                                type="text"
                                name="serverLabel"
                                value={serverLabel}
                                onChange={(e) => {
                                    setServerLabel(e.target.value);
                                    checkLabel(e.target.value);
                                }}
                            />
                            {labelError !== "" && <div className="pt-2 text-red-600">{labelError}</div>}
                        </div>
                        <div className={FormStyles.formInputContainer}>
                            <label className={FormStyles.formInputLabel}>
                                Server Address (Include Protocol and Port Number)
                            </label>
                            <input
                                className={FormStyles.formInput}
                                style={addressError !== "" ? { border: "2px solid red" } : {}}
                                type="text"
                                name="serverAddress"
                                value={serverAddress}
                                onChange={(e) => {
                                    setServerAddress(e.target.value);
                                    checkAddress(e.target.value);
                                }}
                            />
                            {addressError !== "" && <div className="pt-2 text-red-600">{addressError}</div>}
                        </div>
                        <div className={FormStyles.formInputContainer}>
                            <label className={FormStyles.formInputLabel}>Server Group ID</label>
                            <input
                                className={FormStyles.formInput}
                                style={serverGroupIdError !== "" ? { border: "2px solid red" } : {}}
                                type="password"
                                name="serverGroupId"
                                value={serverGroupId}
                                onChange={(e) => {
                                    setServerGroupId(e.target.value);
                                    checkServerGroupId(e.target.value);
                                }}
                            />
                            {serverGroupIdError !== "" && <div className="pt-2 text-red-600">{serverGroupIdError}</div>}
                        </div>
                        <div className={FormStyles.formInputContainer}>
                            <label className={FormStyles.formInputLabel}>Admin Password</label>
                            <input
                                className={FormStyles.formInput}
                                style={adminPasswordError !== "" ? { border: "2px solid red" } : {}}
                                type="password"
                                name="adminPassword"
                                value={adminPassword}
                                onChange={(e) => {
                                    setAdminPassword(e.target.value);
                                    checkAdminPassword(e.target.value);
                                }}
                            />
                            {adminPasswordError !== "" && <div className="pt-2 text-red-600">{adminPasswordError}</div>}
                        </div>
                        <div className="content-center mx-auto text-center pt-4">
                            {disableSubmit() && !processing && (
                                <button
                                    disabled={true}
                                    className="cursor-not-allowed disabled:opacity-50 mx-auto h-10 px-10 text-sm text-white transition-colors duration-150 bg-omnihive-orange rounded-lg focus:shadow-outline hover:bg-omnihive-orangeHover"
                                >
                                    {props.panelData.mode.toLowerCase() === "add" && <span>Register</span>}
                                    {props.panelData.mode.toLowerCase() === "edit" && <span>Edit</span>}
                                </button>
                            )}
                            {!disableSubmit() && !processing && (
                                <button
                                    onClick={submit}
                                    className="mx-auto h-10 px-10 text-sm text-white transition-colors duration-150 bg-omnihive-orange rounded-lg focus:shadow-outline hover:bg-omnihive-orangeHover"
                                >
                                    {props.panelData.mode.toLowerCase() === "add" && <span>Register</span>}
                                    {props.panelData.mode.toLowerCase() === "edit" && <span>Edit</span>}
                                </button>
                            )}
                            {processing && (
                                <button
                                    disabled={true}
                                    className="mx-auto h-10 px-10 text-sm text-white transition-colors duration-150 bg-omnihive-orange rounded-lg focus:shadow-outline hover:bg-omnihive-orangeHover"
                                >
                                    <img src={props.imageSources.spinner} alt="spinner" className="h-3 animate-spin" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
