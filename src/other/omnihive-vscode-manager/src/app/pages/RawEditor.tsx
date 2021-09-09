import {
    AdminEventType,
    AdminResponse,
    EnvironmentVariable,
    IsHelper,
    ServerConfig,
    ServerStatus,
} from "@withonevision/omnihive-core-cjs";
import Parser from "html-react-parser";
import isEqual from "lodash.isequal";
import React from "react";
import AceEditor from "react-ace";
import semver from "semver";
import socketio, { Socket } from "socket.io-client";
import yaml from "yaml";
import { EditorMarkupFormat } from "../../enums/EditorMarkupFormat";
import { VsCodeCommand } from "../../enums/VsCodeCommand";
import { ReactPropsModel } from "../../models/ReactPropsModel";
import { RegisteredServerModel } from "../../models/RegisteredServerModel";
import { VsCodePostMessageModel } from "../../models/VsCodePostMessageModel";
import { ConfirmModal } from "../components/ConfirmModal";
import { ToastError } from "../components/ToastError";
import { ToastSuccess } from "../components/ToastSuccess";
import { ToastWarning } from "../components/ToastWarning";

import "ace-builds/src-noconflict/mode-json";
import "ace-builds/src-noconflict/mode-yaml";
import "ace-builds/src-noconflict/theme-tomorrow_night";

type Props = {
    props: ReactPropsModel;
};

let lastValidatorMessage: string;
let socket: Socket;
let socketReconnectInProgress: boolean = false;

export const RawEditor: React.FC<Props> = ({ props }): React.ReactElement => {
    const bottomRef = React.useRef<HTMLDivElement>();

    const [beeImg, setBeeImg] = React.useState<string>(props.imageSources.beeLight);
    const [currentAppSettings, setCurrentAppSettings] = React.useState<string>("");
    const [editorDirty, setEditorDirty] = React.useState<boolean>(false);
    const [loadedConfig, setLoadedConfig] = React.useState<{
        config: ServerConfig;
        systemEnvironmentVariables: EnvironmentVariable[];
    }>({
        config: new ServerConfig(),
        systemEnvironmentVariables: [],
    });
    const [mouseInBounds, setMouseInBounds] = React.useState<boolean>(true);
    const [retrieving, setRetrieving] = React.useState<boolean>(true);
    const [saving, setSaving] = React.useState<boolean>(false);
    const [showCommands, setShowCommands] = React.useState<boolean>(true);
    const [showConfirm, setShowConfirm] = React.useState<boolean>(false);
    const [showSave, setShowSave] = React.useState<boolean>(false);
    const [showToastError, setShowToastError] = React.useState<boolean>(false);
    const [showToastSuccess, setShowToastSuccess] = React.useState<boolean>(false);
    const [toastErrorMessage, setToastErrorMessage] = React.useState<string>("");
    const [toastSuccessMessage, setToastSuccessMessage] = React.useState<string>("");
    const [validatorLogItems, setValidatorLogItems] = React.useState<string[]>([]);

    const server = props.registeredServers.find(
        (server: RegisteredServerModel) => server.label === props.panelData.serverLabel
    );

    React.useEffect(() => {
        const url: URL = new URL(server.address);
        socket = socketio(`${url.origin}/${server.serverGroupId}`, {
            path: `${url.pathname === "/" ? "" : url.pathname}/socket.io`,
            transports: ["websocket"],
        });

        socket.on("connect", () => {
            socketReconnectInProgress = false;
            socket.emit(AdminEventType.StatusRequest, {
                adminPassword: server.adminPassword,
                serverGroupId: server.serverGroupId,
            });
            socket.emit(AdminEventType.ConfigRequest, {
                adminPassword: server.adminPassword,
                serverGroupId: server.serverGroupId,
            });
        });

        socket.on("connect_error", () => {
            if (socketReconnectInProgress) {
                return;
            }

            socketReconnectInProgress = true;
            setBeeImg(props.imageSources.beeLightRed);
            setShowCommands(false);
            setTimeout(() => {
                socket.connect();
            }, 1000);
        });

        socket.on("disconnect", () => {
            if (socketReconnectInProgress) {
                return;
            }

            socketReconnectInProgress = true;
            setBeeImg(props.imageSources.beeLightRed);
            setShowCommands(false);
            setTimeout(() => {
                socket.connect();
            }, 1000);
        });

        socket.on(
            AdminEventType.ConfigResponse,
            (message: AdminResponse<{ config: ServerConfig; systemEnvironmentVariables: EnvironmentVariable[] }>) => {
                if (message.serverGroupId !== server.serverGroupId) {
                    return;
                }

                setLoadedConfig(message.data);

                const workingSettings: ServerConfig = message.data.config;

                workingSettings.environmentVariables.forEach((value) => {
                    delete value["isSystem"];
                });

                switch (props.extensionConfiguration.generalEditorMarkupFormat) {
                    case EditorMarkupFormat.JSON:
                        setCurrentAppSettings(JSON.stringify(workingSettings, null, "\t"));
                        break;
                    case EditorMarkupFormat.YAML:
                        setCurrentAppSettings(yaml.stringify(workingSettings));
                        break;
                }

                setRetrieving(false);
            }
        );

        socket.on(AdminEventType.ConfigSaveResponse, (message: AdminResponse<{ verified: boolean }>) => {
            if (message.serverGroupId !== server.serverGroupId) {
                return;
            }

            if (!message.requestComplete || !message.data?.verified) {
                setSaving(false);
                showError(message.requestError);
                return;
            }

            setValidatorLogItems([]);
            setEditorDirty(false);
            setSaving(false);
            setShowSave(false);
            showSuccess("Settings Saved Successfully");

            setTimeout(() => {
                const postMessage: VsCodePostMessageModel = {
                    command: VsCodeCommand.RawEditor,
                    data: {
                        settings: currentAppSettings,
                    },
                };

                props.vscode.postMessage(postMessage);
            }, props.extensionConfiguration.generalAlertSuccessTimeout);
        });

        socket.on(
            AdminEventType.StatusResponse,
            (message: AdminResponse<{ serverStatus: ServerStatus; serverError: any }>) => {
                if (message.serverGroupId !== server.serverGroupId) {
                    return;
                }

                switch (message.data.serverStatus) {
                    case ServerStatus.Admin:
                        setBeeImg(props.imageSources.beeLightOrange);
                        setShowCommands(true);
                        break;
                    case ServerStatus.Error:
                        setBeeImg(props.imageSources.beeLightRed);
                        setShowCommands(false);
                        break;
                    case ServerStatus.Offline:
                        setBeeImg(props.imageSources.beeLightRed);
                        setShowCommands(false);
                        break;
                    case ServerStatus.Online:
                        setBeeImg(props.imageSources.beeLightGreen);
                        setShowCommands(true);
                        break;
                    case ServerStatus.Rebuilding:
                        setBeeImg(props.imageSources.beeLightYellow);
                        setShowCommands(false);
                        break;
                    case ServerStatus.Unknown:
                        setBeeImg(props.imageSources.beeLightGrey);
                        setShowCommands(false);
                        break;
                    default:
                        setBeeImg(props.imageSources.beeLightGrey);
                        setShowCommands(false);
                        break;
                }
            }
        );

        socket.connect();
    }, []);

    React.useEffect(() => {
        document.addEventListener("mouseleave", windowMouseLeave);
        document.addEventListener("mouseenter", windowMouseEnter);
        return () => {
            window.removeEventListener("mouseenter", windowMouseEnter);
            window.removeEventListener("mouseleave", windowMouseLeave);
        };
    }, []);

    React.useEffect(() => {
        if (!IsHelper.isNullOrUndefined(bottomRef) && !IsHelper.isNullOrUndefined(bottomRef.current)) {
            bottomRef.current.scrollIntoView();
        }
    }, [validatorLogItems]);

    React.useEffect(() => {
        return () => {
            socket.disconnect();
        };
    }, []);

    const windowMouseEnter = () => {
        setMouseInBounds(true);
    };

    const windowMouseLeave = () => {
        setMouseInBounds(false);
    };

    const checkApplyConfiguration = (newConfig: string): void => {
        if (!validateConfiguration(newConfig)) {
            setShowSave(false);
            return;
        }

        let parsedCurrentSettings: ServerConfig;

        switch (props.extensionConfiguration.generalEditorMarkupFormat) {
            case EditorMarkupFormat.JSON:
                parsedCurrentSettings = JSON.parse(newConfig) as ServerConfig;
                break;
            case EditorMarkupFormat.YAML:
                parsedCurrentSettings = yaml.parse(newConfig) as ServerConfig;
                break;
        }

        const sameSettings: boolean = isEqual(loadedConfig.config, parsedCurrentSettings);

        setEditorDirty(!sameSettings);

        if (sameSettings) {
            setShowSave(false);

            const newLine: string = `<span style="color:blue;">Pass but settings have not changed<span><br />`;

            if (newLine !== lastValidatorMessage) {
                lastValidatorMessage = newLine;
                setValidatorLogItems((currentLogArray) => [...currentLogArray, newLine]);
                return;
            }
        }

        const newLine: string = `<span style="color:green;">Pass<span><br />`;
        setShowSave(true);

        if (newLine !== lastValidatorMessage) {
            lastValidatorMessage = newLine;
            setValidatorLogItems((currentLogArray) => [...currentLogArray, newLine]);
        }
    };

    const hideToast = () => {
        setToastErrorMessage("");
        setToastSuccessMessage("");
        setShowToastError(false);
        setShowToastSuccess(false);
    };

    const pushNewError = (text: string) => {
        const newLine: string = `<span style="color:red;">${text}<span><br />`;

        if (newLine !== lastValidatorMessage) {
            lastValidatorMessage = newLine;
            setValidatorLogItems((currentLogArray) => [...currentLogArray, newLine]);
        }
    };

    const saveChanges = () => {
        setShowConfirm(false);
        setSaving(true);

        let parsedConfig: any;
        let loadedConfigAssign: { config: ServerConfig; systemEnvironmentVariables: EnvironmentVariable[] } = {
            config: new ServerConfig(),
            systemEnvironmentVariables: [],
        };

        switch (props.extensionConfiguration.generalEditorMarkupFormat) {
            case EditorMarkupFormat.JSON:
                parsedConfig = JSON.parse(currentAppSettings);
                break;
            case EditorMarkupFormat.YAML:
                parsedConfig = yaml.parse(currentAppSettings);
                break;
        }

        loadedConfigAssign.config = parsedConfig;
        loadedConfigAssign.systemEnvironmentVariables = loadedConfig.systemEnvironmentVariables;

        setLoadedConfig(loadedConfigAssign);

        if (!socket.connected) {
            socket.connect();
        }

        switch (props.extensionConfiguration.generalEditorMarkupFormat) {
            case EditorMarkupFormat.JSON:
                socket.emit(AdminEventType.ConfigSaveRequest, {
                    adminPassword: server.adminPassword,
                    serverGroupId: server.serverGroupId,
                    data: { config: parsedConfig },
                });
                break;
            case EditorMarkupFormat.YAML:
                socket.emit(AdminEventType.ConfigSaveRequest, {
                    adminPassword: server.adminPassword,
                    serverGroupId: server.serverGroupId,
                    data: { config: parsedConfig },
                });
                break;
        }
    };

    const showError = (error: string) => {
        setToastSuccessMessage("");
        setToastErrorMessage(error);
        setShowToastError(true);
        setShowToastSuccess(false);

        setTimeout(() => {
            hideToast();
        }, props.extensionConfiguration.generalAlertErrorTimeout);
    };

    const showSuccess = (message: string) => {
        setToastErrorMessage("");
        setToastSuccessMessage(message);
        setShowToastError(false);
        setShowToastSuccess(true);

        setTimeout(() => {
            hideToast();
        }, props.extensionConfiguration.generalAlertSuccessTimeout);
    };

    const validateConfiguration = (inputString: string): boolean => {
        let configPass: boolean = true;

        /* Check basic parse */

        let parsed: any;

        try {
            switch (props.extensionConfiguration.generalEditorMarkupFormat) {
                case EditorMarkupFormat.JSON:
                    parsed = JSON.parse(inputString);
                    break;
                case EditorMarkupFormat.YAML:
                    parsed = yaml.parse(inputString);
                    break;
            }
        } catch {
            pushNewError(`Fail Basic Parse`);
            return false;
        }

        /* Check root keys */

        Object.keys(parsed).forEach((key: string) => {
            if (!configPass) {
                return;
            }

            if (key !== "environmentVariables" && key !== "workers") {
                pushNewError(`Invalid Root Key Name : ${key}`);
                configPass = false;
                return;
            }

            if (IsHelper.isNullOrUndefined(parsed[key])) {
                pushNewError(`Root Key is Undefined : ${key}`);
                configPass = false;
                return;
            }

            if (!IsHelper.isArray(parsed[key])) {
                pushNewError(`Root Key is Not an Array : ${key}`);
                configPass = false;
                return;
            }
        });

        if (!configPass) {
            return false;
        }

        /* Check environment */
        if (!IsHelper.isArray(parsed.environmentVariables)) {
            pushNewError("Environment Basic Array Failure");
            return false;
        }

        const envVariables = Array.from(parsed.environmentVariables);
        let environmentNames: string[] = [];

        envVariables.forEach((variable: any) => {
            if (!configPass) {
                return;
            }

            if (
                IsHelper.isNullOrUndefined(variable.key) ||
                IsHelper.isNullOrUndefined(variable.type) ||
                IsHelper.isNullOrUndefined(variable.value)
            ) {
                pushNewError(
                    `Missing or extra values of environment object keys null check: ${variable?.key ?? "Unknown"}`
                );
                configPass = false;
            }

            if (IsHelper.isNullOrUndefined(variable.key) || IsHelper.isEmptyStringOrWhitespace(variable.key)) {
                pushNewError(`Environment variable key cannot be blank : Unknown`);
                configPass = false;
            }

            if (
                IsHelper.isNullOrUndefined(variable.type) ||
                IsHelper.isEmptyStringOrWhitespace(variable.type) ||
                (variable.type.toString() !== "string" &&
                    variable.type.toString() !== "number" &&
                    variable.type.toString() !== "boolean")
            ) {
                pushNewError(
                    `Environment variable type is invalid...validation cannot continue : ${variable?.key ?? "Unknown"}`
                );
                configPass = false;
            }

            if (!configPass) {
                return;
            }

            switch (variable.type) {
                case "boolean":
                    if (IsHelper.isNullOrUndefined(variable.value) || !IsHelper.isBoolean(variable.value)) {
                        pushNewError(
                            `Environment variable value must be boolean if type is boolean: ${
                                variable?.key ?? "Unknown"
                            }`
                        );
                        configPass = false;
                    }
                    break;
                case "number":
                    if (IsHelper.isNullOrUndefined(variable.value) || !IsHelper.isNumber(variable.value)) {
                        pushNewError(
                            `Environment variable value must be numeric if type is number: ${
                                variable?.key ?? "Unknown"
                            }`
                        );
                        configPass = false;
                    }
                    break;
                default:
                    if (
                        IsHelper.isNullOrUndefined(variable.value) ||
                        IsHelper.isEmptyStringOrWhitespace(variable.value)
                    ) {
                        pushNewError(
                            `Environment variable value must be non-whitespace string if type is string: ${
                                variable?.key ?? "Unknown"
                            }`
                        );
                        configPass = false;
                    }
                    break;
            }

            Object.keys(variable).forEach((key: string) => {
                if (!configPass) {
                    return;
                }

                if (key !== "key" && key !== "value" && key !== "type" && key !== "isSystem") {
                    pushNewError(`Invalid Environment Key Name : ${key}`);
                    configPass = false;
                    return;
                }
            });

            if (environmentNames.some((existingKey: string) => existingKey === variable.key)) {
                pushNewError(`Duplicate Environment Name : ${variable.key}`);
                configPass = false;
                return;
            } else {
                environmentNames.push(variable.key);
            }
        });

        if (!configPass) {
            return false;
        }

        /* Check workers */

        if (!IsHelper.isArray(parsed.workers)) {
            pushNewError("Workers Basic Array Failure");
            return false;
        }

        const workers = Array.from(parsed.workers);
        let workerNames: string[] = [];

        workers.forEach((worker: any) => {
            if (!configPass) {
                return;
            }

            Object.keys(worker).forEach((key: string) => {
                if (!configPass) {
                    return;
                }

                if (
                    key !== "type" &&
                    key !== "name" &&
                    key !== "package" &&
                    key !== "version" &&
                    key !== "importPath" &&
                    key !== "default" &&
                    key !== "enabled" &&
                    key !== "metadata"
                ) {
                    pushNewError(`Invalid Worker Key Name : ${key}`);
                    configPass = false;
                    return;
                }

                switch (key) {
                    case "type":
                    case "name":
                    case "package":
                    case "version":
                    case "importPath":
                        if (!IsHelper.isString(worker[key])) {
                            pushNewError(`Invalid/Blank/Null Worker Key Type : ${key}`);
                            configPass = false;
                            return;
                        }
                        break;
                    case "default":
                    case "enabled":
                        if (!IsHelper.isBoolean(worker[key])) {
                            pushNewError(`Invalid/Blank/Null Worker Key Type : ${key}`);
                            configPass = false;
                            return;
                        }
                        break;
                    case "metadata":
                        if (!IsHelper.isPlainObject(worker[key])) {
                            pushNewError(`Invalid/Blank/Null Worker Key Type : ${key}`);
                            configPass = false;
                            return;
                        }
                        break;
                }
            });

            if (Object.keys(worker).length !== 8) {
                pushNewError(`Invalid Number of Worker Object Keys : ${worker.name}`);
            }

            if (IsHelper.isEmptyStringOrWhitespace(worker.name)) {
                pushNewError(`Invalid Worker Name : (blank)`);
                configPass = false;
                return;
            }

            if (IsHelper.isEmptyStringOrWhitespace(worker.type)) {
                pushNewError(`Invalid Worker Type : ${worker.name}`);
                configPass = false;
                return;
            }

            if (IsHelper.isEmptyStringOrWhitespace(worker.importPath)) {
                pushNewError(`Invalid Worker Import Path : ${worker.name}`);
                configPass = false;
                return;
            }

            if (worker.name.includes(" ")) {
                pushNewError(`It is not recommended for worker name to have a space : ${worker.name}`);
                configPass = false;
                return;
            }

            if (worker.type.includes(" ")) {
                pushNewError(`It is not recommended for worker type to have a space : ${worker.name}`);
                configPass = false;
                return;
            }

            if ((worker.importPath as string).includes("..")) {
                if (!IsHelper.isEmptyStringOrWhitespace(worker.package)) {
                    pushNewError(`Local worker import path cannot have a package : ${worker.name}`);
                    configPass = false;
                    return;
                }

                if (!IsHelper.isEmptyStringOrWhitespace(worker.version)) {
                    pushNewError(`Local worker import path cannot have a version : ${worker.name}`);
                    configPass = false;
                    return;
                }
            } else {
                if (worker.package.includes(" ")) {
                    pushNewError(`Invalid Worker Package : ${worker.name}`);
                    configPass = false;
                    return;
                }

                if (worker.version.includes(" ")) {
                    pushNewError(`Invalid Worker Version : ${worker.name}`);
                    configPass = false;
                    return;
                }

                if (!semver.valid(worker.version) && worker.version !== "workspace:*") {
                    pushNewError(`Invalid Worker Version : ${worker.name}`);
                    configPass = false;
                    return;
                }
            }

            if (workerNames.some((existingKey: string) => existingKey === worker.name)) {
                pushNewError(`Duplicate Worker Name : ${worker.name}`);
                configPass = false;
                return;
            } else {
                workerNames.push(worker.name);
            }
        });

        if (!configPass) {
            return false;
        }

        return true;
    };

    return (
        <>
            {showConfirm && (
                <ConfirmModal
                    confirmMessage={
                        props.extensionConfiguration.generalAutoRefreshServer === true
                            ? "Click OK to confirm the settings changes.  Your server will be immediately refreshed."
                            : "Click OK to confirm the settings changes.  The settings change will not be available until the next server refresh."
                    }
                    onCancel={() => setShowConfirm(false)}
                    onOk={() => saveChanges()}
                    imageSources={props.imageSources}
                />
            )}
            {!mouseInBounds && editorDirty && (
                <ToastWarning
                    show={true}
                    message={"Please note you have unsaved changes"}
                    warningPng={props.imageSources.warning}
                />
            )}
            <ToastSuccess
                show={showToastSuccess}
                message={toastSuccessMessage}
                successPng={props.imageSources.success}
            />
            <ToastError show={showToastError} message={toastErrorMessage} errorPng={props.imageSources.error} />
            <div className="flex flex-col h-screen">
                {/* Header */}
                <div className="w-full mb-2 flex justify-between items-center shadow-md h-20 mt-1">
                    <div className="flex items-center ml-5">
                        <div className="pr-5">
                            <img className="align-middle h-12" alt="OmniHive Logo" src={beeImg} />
                        </div>
                        <div>
                            <span className="font-bold text-white text-base">
                                OMNIHIVE RAW CONFIG EDITOR - {props.panelData.serverLabel.toUpperCase()}
                            </span>
                        </div>
                    </div>
                    {showSave && showCommands && (
                        <div className="mt-2 mr-10">
                            {saving && (
                                <button type="button" title="Saving...">
                                    <img src={props.imageSources.spinner} alt="spinner" className="h-8 animate-spin" />
                                </button>
                            )}
                            {!saving && (
                                <button type="button" title="Save Changes" onClick={() => setShowConfirm(true)}>
                                    <img src={props.imageSources.upload} alt="upload" className="h-10" />
                                </button>
                            )}
                        </div>
                    )}
                </div>
                <div className="h-3/4 w-full flex-1 px-20 pt-5 overflow-y-scroll">
                    <div className="box border rounded flex flex-col shadow bg-white h-3/4">
                        <div className="bg-omnihive-orange rounded px-3 py-2 border-b">
                            <div className="flex flex-row">
                                <div className="w-1/2">
                                    <h3 className="text-sm text-white font-medium mt-1">Configuration</h3>
                                </div>
                                <div className="w-1/2">
                                    <button
                                        className="float-right"
                                        onClick={() => setValidatorLogItems([])}
                                        title="Clear Log"
                                    >
                                        <img src={props.imageSources.trash} alt="trash" className="h-6" />
                                    </button>
                                </div>
                            </div>
                        </div>
                        {!retrieving && (
                            <div className="flex flex-row h-full">
                                <AceEditor
                                    wrapEnabled={true}
                                    height="100%"
                                    width="60%"
                                    mode={
                                        props.extensionConfiguration.generalEditorMarkupFormat ===
                                        EditorMarkupFormat.YAML
                                            ? "yaml"
                                            : "json"
                                    }
                                    theme="tomorrow_night"
                                    name="metadata"
                                    highlightActiveLine={true}
                                    onLoad={(editor) => {
                                        editor.getSession().setValue(currentAppSettings);
                                    }}
                                    onChange={(e) => {
                                        checkApplyConfiguration(e);
                                        setCurrentAppSettings(e);
                                    }}
                                    setOptions={{ useWorker: false }}
                                    editorProps={{ $blockScrolling: true }}
                                />
                                <div className="flex flex-col" style={{ width: "40%" }}>
                                    <div className="overflow-y-auto" style={{ minHeight: 400, maxHeight: 400 }}>
                                        {validatorLogItems &&
                                            validatorLogItems.map((item, index) => (
                                                <p key={index}>
                                                    <span
                                                        style={{
                                                            minWidth: 30,
                                                            width: 30,
                                                            color: "grey",
                                                            display: "inline-block",
                                                            paddingRight: 5,
                                                            borderRight: "1px dotted grey",
                                                            marginRight: 5,
                                                        }}
                                                    >
                                                        {index + 1}
                                                    </span>
                                                    {Parser(item)}
                                                </p>
                                            ))}
                                        <div ref={bottomRef} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};
