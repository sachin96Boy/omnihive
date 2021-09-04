import { AdminEventType } from "@withonevision/omnihive-core/enums/AdminEventType";
import { EnvironmentVariableType } from "@withonevision/omnihive-core/enums/EnvironmentVariableType";
import { ServerStatus } from "@withonevision/omnihive-core/enums/ServerStatus";
import { AdminResponse } from "@withonevision/omnihive-core/models/AdminResponse";
import { EnvironmentVariable } from "@withonevision/omnihive-core/models/EnvironmentVariable";
import { HiveWorkerConfig } from "@withonevision/omnihive-core/models/HiveWorkerConfig";
import { ServerConfig } from "@withonevision/omnihive-core/models/ServerConfig";
import { ColDef, GridApi, GridReadyEvent } from "ag-grid-community";
import "ag-grid-community/dist/styles/ag-grid.css";
import "ag-grid-community/dist/styles/ag-theme-alpine.css";
import { AgGridReact } from "ag-grid-react";
import React from "react";
import socketio, { Socket } from "socket.io-client";
import { VsCodeCommand } from "../../enums/VsCodeCommand";
import { ReactPropsModel } from "../../models/ReactPropsModel";
import { RegisteredServerModel } from "../../models/RegisteredServerModel";
import { VsCodePostMessageModel } from "../../models/VsCodePostMessageModel";
import { ConfirmModal } from "../components/ConfirmModal";
import { EnvironmentEditorObject, EnvironmentModal } from "../components/EnvironmentModal";
import { ToastError } from "../components/ToastError";
import { ToastSuccess } from "../components/ToastSuccess";
import { ToastWarning } from "../components/ToastWarning";
import { WorkerEditorObject, WorkerModal } from "../components/WorkerModal";
import { IsHelper } from "@withonevision/omnihive-core/helpers/IsHelper";
import "../styles/editor.css";

type Props = {
    panelProps: ReactPropsModel;
    settingsSection: string;
};

let socket: Socket;
let socketReconnectInProgress: boolean = false;

export const SettingsEditor: React.FC<Props> = (props): React.ReactElement => {
    const [addMode, setAddMode] = React.useState<boolean>(false);
    const [beeImg, setBeeImg] = React.useState<string>(props.panelProps.imageSources.beeLight);
    const [codeCommand, setCodeCommand] = React.useState<VsCodeCommand>();
    const [dataTableColumns, setDataTableColumns] = React.useState<ColDef[]>([]);
    const [dataTableRows, setDataTableRows] = React.useState<any[]>([]);
    const [environmentEditorObject, setEnvironmentEditorObject] = React.useState<EnvironmentEditorObject>(undefined);
    const [gridApi, setGridApi] = React.useState<GridApi>(null);
    const [mouseInBounds, setMouseInBounds] = React.useState<boolean>(true);
    const [saving, setSaving] = React.useState<boolean>(false);
    const [serverConfig, setServerConfig] = React.useState<ServerConfig>(new ServerConfig());
    const [showAdd, setShowAdd] = React.useState<boolean>(false);
    const [showAddTypeDropdown, setShowAddTypeDropdown] = React.useState<boolean>(false);
    const [showCommands, setShowCommands] = React.useState<boolean>(true);
    const [showConfirm, setShowConfirm] = React.useState<boolean>(false);
    const [showEditor, setShowEditor] = React.useState<boolean>(false);
    const [showSave, setShowSave] = React.useState<boolean>(false);
    const [showToastSuccess, setShowToastSuccess] = React.useState<boolean>(false);
    const [showToastError, setShowToastError] = React.useState<boolean>(false);
    const [toastErrorMessage, setToastErrorMessage] = React.useState<string>("");
    const [toastSuccessMessage, setToastSuccessMessage] = React.useState<string>("");
    const [workerEditorObject, setWorkerEditorObject] = React.useState<WorkerEditorObject>(undefined);

    const server = props.panelProps.registeredServers.find(
        (server: RegisteredServerModel) => server.label === props.panelProps.panelData.serverLabel
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

            socketReconnectInProgress = false;
            setBeeImg(props.panelProps.imageSources.beeLightRed);
            setShowCommands(false);
            setTimeout(() => {
                socket.connect();
            }, 1000);
        });

        socket.on("disconnect", () => {
            if (socketReconnectInProgress) {
                return;
            }

            socketReconnectInProgress = false;
            setBeeImg(props.panelProps.imageSources.beeLightRed);
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

                if (IsHelper.isNullOrUndefined(message) || !message.requestComplete || !message.data.config) {
                    showError(message.requestError);
                    return;
                }

                if (
                    !IsHelper.isNullOrUndefined(message.data.systemEnvironmentVariables) &&
                    IsHelper.isArray(message.data.systemEnvironmentVariables) &&
                    message.data.systemEnvironmentVariables.length > 0
                ) {
                    message.data.systemEnvironmentVariables.forEach((envVariable: EnvironmentVariable) => {
                        message.data.config.environmentVariables.push(envVariable);
                    });
                }

                setServerConfig(message.data.config);
                setupComponent(message.data.config);
            }
        );

        socket.on(AdminEventType.ConfigSaveResponse, (message: AdminResponse<{ verified: boolean }>) => {
            if (message.serverGroupId !== server.serverGroupId) {
                return;
            }

            setSaving(false);
            setShowSave(false);

            if (IsHelper.isNullOrUndefined(message) || !message.requestComplete || !message.data?.verified) {
                showError(JSON.stringify(message.requestError));
                return;
            }

            showSuccess("Settings Saved Successfully");

            setTimeout(() => {
                const postMessage: VsCodePostMessageModel = {
                    command: codeCommand,
                    data: {
                        settings: serverConfig,
                    },
                };

                props.panelProps.vscode.postMessage(postMessage);
            }, props.panelProps.extensionConfiguration.generalAlertSuccessTimeout);
        });

        socket.on(
            AdminEventType.StatusResponse,
            (message: AdminResponse<{ serverStatus: ServerStatus; serverError: any }>) => {
                if (message.serverGroupId !== server.serverGroupId) {
                    return;
                }

                switch (message.data.serverStatus) {
                    case ServerStatus.Admin:
                        setBeeImg(props.panelProps.imageSources.beeLightOrange);
                        setShowCommands(true);
                        break;
                    case ServerStatus.Error:
                        setBeeImg(props.panelProps.imageSources.beeLightRed);
                        setShowCommands(false);
                        break;
                    case ServerStatus.Offline:
                        setBeeImg(props.panelProps.imageSources.beeLightRed);
                        setShowCommands(false);
                        break;
                    case ServerStatus.Online:
                        setBeeImg(props.panelProps.imageSources.beeLightGreen);
                        setShowCommands(true);
                        break;
                    case ServerStatus.Rebuilding:
                        setBeeImg(props.panelProps.imageSources.beeLightYellow);
                        setShowCommands(false);
                        break;
                    case ServerStatus.Unknown:
                        setBeeImg(props.panelProps.imageSources.beeLightGrey);
                        setShowCommands(false);
                        break;
                    default:
                        setBeeImg(props.panelProps.imageSources.beeLightGrey);
                        setShowCommands(false);
                        break;
                }
            }
        );
    }, []);

    React.useEffect(() => {
        return () => {
            socket.disconnect();
        };
    }, []);

    React.useEffect(() => {
        document.addEventListener("mouseleave", windowMouseLeave);
        document.addEventListener("mouseenter", windowMouseEnter);
        return () => {
            window.removeEventListener("mouseenter", windowMouseEnter);
            window.removeEventListener("mouseleave", windowMouseLeave);
        };
    }, []);

    const windowMouseEnter = () => {
        setMouseInBounds(true);
    };

    const windowMouseLeave = () => {
        setMouseInBounds(false);
    };

    const setupComponent = (config: ServerConfig) => {
        /* Show Add */
        setShowAdd(true);

        /* Data Columns */
        switch (props.settingsSection) {
            case "environmentVariables":
                setDataTableColumns([
                    {
                        headerName: "",
                        hide: true,
                        field: "index",
                    },
                    {
                        headerName: "Key",
                        field: "key",
                        resizable: true,
                        sortable: true,
                        filter: true,
                        sort: "asc",
                        cellClass: (params) => {
                            if (params.data.isSystem === true) {
                                return "ag-grid-oh-system-env-variable";
                            }

                            return "";
                        },
                    },
                    {
                        headerName: "Value",
                        field: "value",
                        resizable: true,
                        sortable: true,
                        filter: true,
                        cellClass: (params) => {
                            if (params.data.isSystem === true) {
                                return "ag-grid-oh-system-env-variable";
                            }

                            return "";
                        },
                    },
                    {
                        headerName: "",
                        hide: true,
                        field: "type",
                    },
                    {
                        headerName: "",
                        hide: true,
                        field: "isSystem",
                    },
                ]);
                break;
            case "workers":
                setDataTableColumns([
                    {
                        headerName: "",
                        hide: true,
                        field: "index",
                    },
                    {
                        headerName: "Name",
                        field: "name",
                        resizable: true,
                        sortable: true,
                        filter: true,
                    },
                    {
                        headerName: "Type",
                        field: "type",
                        resizable: true,
                        sortable: true,
                        filter: true,
                    },
                    {
                        headerName: "Package",
                        field: "package",
                        resizable: true,
                        sortable: true,
                        filter: true,
                    },
                    {
                        headerName: "Version",
                        field: "version",
                        resizable: true,
                        sortable: true,
                        filter: true,
                    },
                ]);
                break;
        }

        /* Data Rows */

        const dataRows: any[] = [];

        switch (props.settingsSection) {
            case "environmentVariables":
                config.environmentVariables.forEach((envVariable: EnvironmentVariable, index) => {
                    dataRows.push({
                        index,
                        key: envVariable.key,
                        type: envVariable.type,
                        value: envVariable.value,
                        isSystem: envVariable.isSystem,
                    });
                });
                break;
            case "workers":
                config.workers.forEach((worker: HiveWorkerConfig, index) => {
                    dataRows.push({
                        index,
                        name: worker.name,
                        type: worker.type,
                        package: worker.package,
                        version: worker.version,
                        importPath: worker.importPath,
                        default: worker.default,
                        enabled: worker.enabled,
                        metadata: worker.metadata,
                    });
                });
                break;
        }

        /* VS Code Command */
        switch (props.settingsSection) {
            case "envrionment":
                setCodeCommand(VsCodeCommand.EditServerEnvironment);
                break;
            case "workers":
                setCodeCommand(VsCodeCommand.EditServerWorkers);
                break;
        }

        setDataTableRows(dataRows);
    };

    const addButtonHandler = (addType: string) => {
        setAddMode(true);
        let newValue: string | number | boolean;
        let newEnvrionmentVariableType: EnvironmentVariableType;

        switch (addType) {
            case "string":
                newValue = "";
                newEnvrionmentVariableType = EnvironmentVariableType.String;
                break;
            case "number":
                newValue = 0;
                newEnvrionmentVariableType = EnvironmentVariableType.Number;
                break;
            case "boolean":
                newValue = false;
                newEnvrionmentVariableType = EnvironmentVariableType.Boolean;
                break;
            case "workers":
                newValue = undefined;
                break;
        }

        switch (props.settingsSection) {
            case "environmentVariables":
                setEnvironmentEditorObject({
                    index: -1,
                    value: newValue,
                    type: newEnvrionmentVariableType,
                    key: "",
                    isSystem: false,
                });
                setWorkerEditorObject(undefined);
                break;
            case "workers":
                setEnvironmentEditorObject(undefined);
                setWorkerEditorObject({
                    index: -1,
                    ...new HiveWorkerConfig(),
                });
                break;
        }

        setShowEditor(true);
    };

    const addEditHandlerEnvironment = (model: EnvironmentEditorObject) => {
        const rowCopy = [...dataTableRows];

        if (model.index === -1) {
            let nextIndex: number = 0;

            dataTableRows.forEach((value) => {
                if (+value.index > nextIndex) {
                    nextIndex = +value.index;
                }
            });

            nextIndex++;

            rowCopy.push({
                index: nextIndex,
                key: model.key,
                value: model.value,
                type: model.type,
                isSystem: model.isSystem,
            });
        } else {
            rowCopy.splice(model.index, 1, {
                index: model.index,
                key: model.key,
                value: model.value,
                type: model.type,
                isSystem: model.isSystem,
            });
        }

        setDataTableRows(rowCopy);
        setShowEditor(false);
        setAddMode(false);
        setShowSave(true);
    };

    const addEditHandlerWorker = (model: WorkerEditorObject) => {
        const rowCopy = [...dataTableRows];

        if (model.index === -1) {
            let nextIndex: number = 0;

            dataTableRows.forEach((value) => {
                if (+value.index > nextIndex) {
                    nextIndex = +value.index;
                }
            });

            nextIndex++;

            rowCopy.push({
                index: nextIndex,
                name: model.name,
                type: model.type,
                package: model.package,
                version: model.version,
                importPath: model.importPath,
                default: model.default,
                enabled: model.enabled,
                metadata: model.metadata,
            });
        } else {
            rowCopy.splice(model.index, 1, {
                index: model.index,
                name: model.name,
                type: model.type,
                package: model.package,
                version: model.version,
                importPath: model.importPath,
                default: model.default,
                enabled: model.enabled,
                metadata: model.metadata,
            });
        }

        setDataTableRows(rowCopy);
        setShowEditor(false);
        setAddMode(false);
        setShowSave(true);
    };

    const deleteHandler = (index: number) => {
        let rowCopy: any[] = [...dataTableRows];
        rowCopy = rowCopy.filter((value) => value.index !== index);
        setDataTableRows(rowCopy);

        setShowEditor(false);
        setAddMode(false);
        setShowSave(true);
    };

    const getModalCompareKeys = (): string[] => {
        const keyList: string[] = [];
        dataTableRows.forEach((row) => {
            switch (props.settingsSection) {
                case "environmentVariables":
                    keyList.push(row["key"]);
                    break;
                case "workers":
                    keyList.push(row["name"]);
                    break;
            }
        });

        return keyList;
    };

    const gridReady = (event: GridReadyEvent) => {
        event.api.sizeColumnsToFit();
        setGridApi(event.api);
    };

    const gridSelection = () => {
        const selectedRows = gridApi.getSelectedRows();

        if (
            props.settingsSection === "environmentVariables" &&
            selectedRows.length > 0 &&
            !IsHelper.isNullOrUndefined(selectedRows[0]) &&
            !IsHelper.isNullOrUndefined(selectedRows[0].isSystem) &&
            selectedRows[0].isSystem === true
        ) {
            return;
        }

        switch (props.settingsSection) {
            case "environmentVariables":
                setEnvironmentEditorObject({
                    index: selectedRows[0].index,
                    key: selectedRows[0].key,
                    value: selectedRows[0].value,
                    type: selectedRows[0].type,
                    isSystem: selectedRows[0].isSystem,
                });
                setWorkerEditorObject(undefined);
                break;
            case "workers":
                setEnvironmentEditorObject(undefined);
                setWorkerEditorObject({
                    index: selectedRows[0].index,
                    name: selectedRows[0].name,
                    type: selectedRows[0].type,
                    package: selectedRows[0].package,
                    version: selectedRows[0].version,
                    importPath: selectedRows[0].importPath,
                    default: selectedRows[0].default,
                    enabled: selectedRows[0].enabled,
                    metadata: selectedRows[0].metadata,
                });
                break;
        }

        setShowEditor(true);
    };

    const hideToast = () => {
        setToastErrorMessage("");
        setToastSuccessMessage("");
        setShowToastError(false);
        setShowToastSuccess(false);
    };

    const saveChanges = () => {
        setShowConfirm(false);
        setSaving(true);

        const currentServerSettings = Object.assign(serverConfig);

        switch (props.settingsSection) {
            case "environmentVariables":
                const newEnvrionmentVariables: EnvironmentVariable[] = [];

                dataTableRows.forEach((row) => {
                    if (row.isSystem === true) {
                        return;
                    }

                    newEnvrionmentVariables.push({
                        key: row.key,
                        value: row.value,
                        type: row.type,
                        isSystem: false,
                    });
                });

                currentServerSettings.environmentVariables = newEnvrionmentVariables;
                break;
            case "workers":
                const newWorkers: HiveWorkerConfig[] = [];

                dataTableRows.forEach((row) => {
                    newWorkers.push({
                        name: row.name,
                        type: row.type,
                        package: row.package,
                        version: row.version,
                        importPath: row.importPath,
                        default: row.default,
                        enabled: row.enabled,
                        metadata: row.metadata,
                    });
                });

                currentServerSettings.workers = newWorkers;
                break;
        }
        setServerConfig(currentServerSettings);
        socket.emit(AdminEventType.ConfigSaveRequest, {
            adminPassword: server.adminPassword,
            serverGroupId: server.serverGroupId,
            data: { config: currentServerSettings },
        });
    };

    const showError = (error: string) => {
        setToastSuccessMessage("");
        setToastErrorMessage(error);
        setShowToastError(true);
        setShowToastSuccess(false);

        setTimeout(() => {
            //hideToast();
        }, props.panelProps.extensionConfiguration.generalAlertErrorTimeout);
    };

    const showSuccess = (message: string) => {
        setToastErrorMessage("");
        setToastSuccessMessage(message);
        setShowToastError(false);
        setShowToastSuccess(true);

        setTimeout(() => {
            hideToast();
        }, props.panelProps.extensionConfiguration.generalAlertSuccessTimeout);
    };

    return (
        <>
            {/* Confirmation Modals */}
            {showConfirm && (
                <ConfirmModal
                    confirmMessage={
                        props.panelProps.extensionConfiguration.generalAutoRefreshServer === true
                            ? "Click OK to confirm the settings changes.  Your server will be immediately refreshed."
                            : "Click OK to confirm the settings changes.  The settings change will not be available until the next server refresh."
                    }
                    onCancel={() => setShowConfirm(false)}
                    onOk={() => saveChanges()}
                    imageSources={props.panelProps.imageSources}
                />
            )}
            {!mouseInBounds && showSave && (
                <ToastWarning
                    show={true}
                    message={"Please note you have unsaved changes"}
                    warningPng={props.panelProps.imageSources.warning}
                />
            )}
            {/* Toast Handlers */}
            <ToastSuccess
                show={showToastSuccess}
                message={toastSuccessMessage}
                successPng={props.panelProps.imageSources.success}
            />
            <ToastError
                show={showToastError}
                message={toastErrorMessage}
                errorPng={props.panelProps.imageSources.error}
            />

            <div className="flex flex-col h-screen">
                {/* Header */}
                <div className="w-full mb-2 flex justify-between items-center shadow-md h-20">
                    <div className="flex items-center ml-5">
                        <div className="pr-5">
                            <img className="align-middle h-12" alt="OmniHive Logo" src={beeImg} />
                        </div>
                        <div>
                            <span className="font-bold text-white text-base">
                                OMNIHIVE EDIT {props.settingsSection.toUpperCase()} -{" "}
                                {props.panelProps.panelData.serverLabel.toUpperCase()}
                            </span>
                        </div>
                    </div>
                    {showSave && showCommands && (
                        <div className="mt-2 mr-10">
                            {saving && (
                                <button type="button" title="Saving...">
                                    <img
                                        src={props.panelProps.imageSources.spinner}
                                        alt="spinner"
                                        className="h-8 animate-spin"
                                    />
                                </button>
                            )}
                            {!saving && (
                                <button type="button" title="Save Changes" onClick={() => setShowConfirm(true)}>
                                    <img src={props.panelProps.imageSources.upload} alt="upload" className="h-10" />
                                </button>
                            )}
                        </div>
                    )}
                </div>
                <div className="h-auto w-full flex-1 px-20 pt-5">
                    {/* Main Table */}
                    {serverConfig && dataTableColumns.length > 0 && (
                        <div className="ag-theme-alpine h-1/2 w-full">
                            <AgGridReact
                                onGridReady={gridReady}
                                columnDefs={dataTableColumns}
                                rowData={dataTableRows}
                                rowSelection={"single"}
                                onRowClicked={gridSelection}
                            ></AgGridReact>
                        </div>
                    )}
                    {showAdd && (
                        <div className="ml-auto flex flex-row-reverse pt-6">
                            {props.settingsSection === "workers" && (
                                <>
                                    <button
                                        onClick={() => addButtonHandler("workers")}
                                        className="cursor-pointer py-2 px-4 capitalize tracking-wide bg-omnihive-orange hover:bg-omnihive-orangeHover text-white font-medium rounded-r rounded-l focus:outline-none"
                                    >
                                        Add Worker
                                    </button>
                                </>
                            )}
                            {props.settingsSection !== "workers" && (
                                <>
                                    <button className="cursor-default py-2 px-4 capitalize tracking-wide bg-omnihive-orange text-white font-medium rounded-r rounded-l-none focus:outline-none">
                                        Add
                                    </button>

                                    <span className="border"></span>

                                    <div className="relative">
                                        <button
                                            className="relative z-10 block bg-omnihive-orange rounded-l rounded-r-none p-2 hover:bg-omnihive-orangeHover focus:outline-none cursor-pointer"
                                            onClick={() => setShowAddTypeDropdown(!showAddTypeDropdown)}
                                        >
                                            <svg
                                                className="h-6 w-6 text-white"
                                                xmlns="http://www.w3.org/2000/svg"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth="2"
                                                    d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"
                                                />
                                            </svg>
                                        </button>

                                        {showAddTypeDropdown && (
                                            <>
                                                <div className="fixed inset-0 h-full w-full"></div>

                                                <div
                                                    className="absolute right-0 mt-2 w-48 bg-white rounded-md overflow-hidden shadow-xl z-20"
                                                    onMouseLeave={() => setShowAddTypeDropdown(false)}
                                                >
                                                    <a
                                                        href="#"
                                                        className="block px-4 py-2 text-sm text-gray-800 border-b hover:bg-yellowHover"
                                                        onClick={() => {
                                                            setShowAddTypeDropdown(false);
                                                            addButtonHandler("string");
                                                        }}
                                                    >
                                                        <span className="text-gray-600">Text Value</span>
                                                    </a>
                                                    <a
                                                        href="#"
                                                        className="block px-4 py-2 text-sm text-gray-800 border-b hover:bg-yellowHover"
                                                        onClick={() => {
                                                            setShowAddTypeDropdown(false);
                                                            addButtonHandler("number");
                                                        }}
                                                    >
                                                        <span className="text-gray-600">Number Value</span>
                                                    </a>
                                                    <a
                                                        href="#"
                                                        className="block px-4 py-2 text-sm text-gray-800 border-b hover:bg-yellowHover"
                                                        onClick={() => {
                                                            setShowAddTypeDropdown(false);
                                                            addButtonHandler("boolean");
                                                        }}
                                                    >
                                                        <span className="text-gray-600">Boolean Value</span>
                                                    </a>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
            {/* Settings Modals */}
            {showEditor && props.settingsSection === "environmentVariables" && (
                <EnvironmentModal
                    compareKeys={getModalCompareKeys()}
                    onCancel={() => setShowEditor(false)}
                    onDelete={(indexValue: number) => deleteHandler(indexValue)}
                    onOk={(editorObject: EnvironmentEditorObject) => addEditHandlerEnvironment(editorObject)}
                    editorObject={environmentEditorObject}
                    imageSources={props.panelProps.imageSources}
                />
            )}
            {showEditor && props.settingsSection === "workers" && (
                <WorkerModal
                    allowDelete={!addMode}
                    compareKeys={getModalCompareKeys()}
                    onOk={(editorObject: WorkerEditorObject) => addEditHandlerWorker(editorObject)}
                    onCancel={() => setShowEditor(false)}
                    onDelete={(indexValue: number) => deleteHandler(indexValue)}
                    editorObject={workerEditorObject}
                    extensionConfiguration={props.panelProps.extensionConfiguration}
                    imageSources={props.panelProps.imageSources}
                />
            )}
        </>
    );
};
