import { AdminEventType } from "@withonevision/omnihive-core/enums/AdminEventType";
import { ServerStatus } from "@withonevision/omnihive-core/enums/ServerStatus";
import { IsHelper } from "@withonevision/omnihive-core/helpers/IsHelper";
import { AdminRequest } from "@withonevision/omnihive-core/models/AdminRequest";
import { AdminResponse } from "@withonevision/omnihive-core/models/AdminResponse";
import { RegisteredUrl } from "@withonevision/omnihive-core/models/RegisteredUrl";
import socketio from "socket.io-client";
import { URL } from "url";
import vscode from "vscode";
import { EditorMarkupFormat } from "../enums/EditorMarkupFormat";
import { VsCodeWebpanelRoute } from "../enums/VsCodeWebpanelRoute";
import { ActivePanel } from "../models/ActivePanel";
import { ExtensionConfiguration } from "../models/ExtensionConfiguration";
import { RegisteredClientModel } from "../models/RegisteredClientModel";
import { RegisteredServerModel } from "../models/RegisteredServerModel";
import { ExtensionTreeProvider } from "../providers/ExtensionTreeProvider";
import { WebViewPanelProvider } from "../providers/WebViewPanelProvider";

export class ExtensionStore {
    private static singleton: ExtensionStore;

    public static getSingleton = (): ExtensionStore => {
        if (!ExtensionStore.singleton) {
            ExtensionStore.singleton = new ExtensionStore();
        }

        return ExtensionStore.singleton;
    };

    public activePanels: ActivePanel[] = [];
    public extensionTreeProvider!: ExtensionTreeProvider;
    public registeredServers: RegisteredServerModel[] = [];
    public registeredClients: RegisteredClientModel[] = [];

    public addServer = (context: vscode.ExtensionContext, registeredServer: RegisteredServerModel): void => {
        this.registeredServers.push(registeredServer);
        this.subscribeToServer(context, registeredServer.label);
        context.globalState.update("oh:registeredServers", this.registeredServers);
        this.extensionTreeProvider._onDidChangeTreeData.fire(undefined);
    };

    public editServer = (
        context: vscode.ExtensionContext,
        oldServerLabel: string,
        registeredServer: RegisteredServerModel
    ): void => {
        this.removeServer(context, oldServerLabel);
        this.addServer(context, registeredServer);
    };

    public getConfiguration = (): ExtensionConfiguration => {
        const extensionConfiguration = new ExtensionConfiguration();

        let generalAlertErrorTimeout: number | undefined = vscode.workspace
            .getConfiguration("omnihive")
            .get<number>("generalSettings.alertErrorTimeout");

        if (generalAlertErrorTimeout) {
            extensionConfiguration.generalAlertErrorTimeout = generalAlertErrorTimeout;
        }

        let generalAlertSuccessTimeout: number | undefined = vscode.workspace
            .getConfiguration("omnihive")
            .get<number>("generalSettings.alertSuccessTimeout");

        if (generalAlertSuccessTimeout) {
            extensionConfiguration.generalAlertSuccessTimeout = generalAlertSuccessTimeout;
        }

        let generalAutoCloseSettings: boolean | undefined = vscode.workspace
            .getConfiguration("omnihive")
            .get<boolean>("generalSettings.autoCloseSettings");

        if (generalAutoCloseSettings) {
            extensionConfiguration.generalAutoCloseSettings = generalAutoCloseSettings;
        }

        let generalAutoOpenLogWindow: boolean | undefined = vscode.workspace
            .getConfiguration("omnihive")
            .get<boolean>("generalSettings.autoOpenLogWindow");

        if (generalAutoOpenLogWindow) {
            extensionConfiguration.generalAutoOpenLogWindow = generalAutoOpenLogWindow;
        }

        let generalAutoRefreshServer: boolean | undefined = vscode.workspace
            .getConfiguration("omnihive")
            .get<boolean>("generalSettings.autoRefreshServer");

        if (generalAutoRefreshServer) {
            extensionConfiguration.generalAutoRefreshServer = generalAutoRefreshServer;
        }

        let generalEditorMarkupFormat: string | undefined = vscode.workspace
            .getConfiguration("omnihive")
            .get<string>("generalSettings.editorMarkupFormat");

        if (!IsHelper.isNullOrUndefinedOrEmptyStringOrWhitespace(generalEditorMarkupFormat)) {
            switch (generalEditorMarkupFormat) {
                case "json":
                    extensionConfiguration.generalEditorMarkupFormat = EditorMarkupFormat.JSON;
                    break;
                case "yaml":
                    extensionConfiguration.generalEditorMarkupFormat = EditorMarkupFormat.YAML;
                    break;
                default:
                    extensionConfiguration.generalEditorMarkupFormat = EditorMarkupFormat.JSON;
                    break;
            }
        }

        let stylesGraphBrowser: string | undefined = vscode.workspace
            .getConfiguration("omnihive")
            .get<string>("styles.graphBrowser");

        if (!IsHelper.isNullOrUndefinedOrEmptyStringOrWhitespace(stylesGraphBrowser)) {
            extensionConfiguration.stylesGraphBrowser = stylesGraphBrowser;
        }

        let stylesSwaggerBrowser: string | undefined = vscode.workspace
            .getConfiguration("omnihive")
            .get<string>("styles.swaggerBrowser");

        if (!IsHelper.isNullOrUndefinedOrEmptyStringOrWhitespace(stylesSwaggerBrowser)) {
            extensionConfiguration.stylesSwaggerBrowser = stylesSwaggerBrowser;
        }

        let stylesWebPanelBackgroundColorHex: string | undefined = vscode.workspace
            .getConfiguration("omnihive")
            .get<string>("styles.webPanelBackgroundColorHex");

        if (!IsHelper.isNullOrUndefinedOrEmptyStringOrWhitespace(stylesWebPanelBackgroundColorHex)) {
            extensionConfiguration.stylesWebPanelBackgroundColorHex = stylesWebPanelBackgroundColorHex;
        }

        return extensionConfiguration;
    };

    public getOhPath = (path: string): string[] => {
        return path.split("||");
    };

    public refreshSchema = (serverLabel: string): boolean => {
        const server: RegisteredServerModel | undefined = this.registeredServers.find(
            (rs: RegisteredServerModel) => rs.label === serverLabel
        );
        const client: RegisteredClientModel | undefined = this.registeredClients.find(
            (rc: RegisteredClientModel) => rc.serverLabel === serverLabel
        );

        if (
            IsHelper.isNullOrUndefined(server) ||
            IsHelper.isNullOrUndefined(client) ||
            IsHelper.isNullOrUndefined(client.socket)
        ) {
            vscode.window.showErrorMessage(`OmniHive server ${serverLabel} could not be contacted`, { modal: true });
            return false;
        }

        try {
            const eventRequest: AdminRequest = {
                adminPassword: server.adminPassword,
                serverGroupId: server.serverGroupId,
            };

            client.socket.emit(AdminEventType.ServerResetRequest, eventRequest);
            vscode.window.showInformationMessage(
                `Schema refresh for OmniHive server ${serverLabel} has been requested`,
                { modal: true }
            );
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`There was a problem refreshing the environment => ${err}`, { modal: true });
            return false;
        }
    };

    public removeAllServers = (context: vscode.ExtensionContext): void => {
        const allServers = context.globalState.get<RegisteredServerModel[]>("oh:registeredServers");

        allServers?.forEach((server: RegisteredServerModel) => {
            this.removeServer(context, server.label);
        });
    };

    public removeServer = (context: vscode.ExtensionContext, serverLabel: string): void => {
        this.registeredServers = this.registeredServers.filter(
            (server: RegisteredServerModel) => server.label !== serverLabel
        );
        this.unsubscribeFromServer(serverLabel);
        context.globalState.update("oh:registeredServers", this.registeredServers);
        this.extensionTreeProvider._onDidChangeTreeData.fire(undefined);
    };

    public subscribeToServer = (
        context: vscode.ExtensionContext,
        serverLabel: string,
        provideFeedback: boolean = false
    ): void => {
        let errorNotificationCount: number = 0;
        const server: RegisteredServerModel | undefined = this.registeredServers.find(
            (server: RegisteredServerModel) => server.label === serverLabel
        );

        if (IsHelper.isNullOrUndefined(server)) {
            return;
        }

        this.unsubscribeFromServer(serverLabel);

        const url: URL = new URL(server.address);
        const socket = socketio(`${url.origin}/${server.serverGroupId}`, {
            path: `${url.pathname === "/" ? "" : url.pathname}/socket.io`,
            transports: ["websocket"],
        });

        socket.on("connect", () => {
            const eventRequest: AdminRequest = {
                adminPassword: server.adminPassword,
                serverGroupId: server.serverGroupId,
            };

            socket.emit(AdminEventType.StatusRequest, eventRequest);

            if (provideFeedback === true) {
                vscode.window.showInformationMessage(`OmniHive Server ${serverLabel} Successfully Connected`);
                errorNotificationCount = 0;
            }
        });

        socket.on("connect_error", () => {
            const server: RegisteredServerModel | undefined = this.registeredServers.find(
                (server: RegisteredServerModel) => server.label === serverLabel
            );

            if (IsHelper.isNullOrUndefined(server)) {
                return;
            }

            const currentStatus: string = server.status;

            if (currentStatus !== ServerStatus.Offline) {
                server.status = ServerStatus.Offline;
                this.extensionTreeProvider._onDidChangeTreeData.fire(undefined);
            }

            if (provideFeedback === true && errorNotificationCount === 0) {
                vscode.window.showErrorMessage(`OmniHive Server ${serverLabel} Failed to Connect`);
                errorNotificationCount++;
            }
        });

        socket.on("disconnect", () => {
            const server: RegisteredServerModel | undefined = this.registeredServers.find(
                (server: RegisteredServerModel) => server.label === serverLabel
            );

            if (IsHelper.isNullOrUndefined(server)) {
                return;
            }

            const currentStatus: string = server.status;

            if (currentStatus !== ServerStatus.Offline) {
                server.status = ServerStatus.Offline;
                this.extensionTreeProvider._onDidChangeTreeData.fire(undefined);
            }

            if (provideFeedback === true && errorNotificationCount === 0) {
                vscode.window.showErrorMessage(`OmniHive Server ${serverLabel} Failed to Connect`);
                errorNotificationCount++;
            }
        });

        socket.on(AdminEventType.ServerResetResponse, (message: AdminRequest) => {
            const server: RegisteredServerModel | undefined = this.registeredServers.find(
                (server: RegisteredServerModel) =>
                    server.label === serverLabel && server.serverGroupId === message.serverGroupId
            );

            if (IsHelper.isNullOrUndefined(server)) {
                return;
            }

            server.status = ServerStatus.Offline;
            this.extensionTreeProvider._onDidChangeTreeData.fire(undefined);

            setTimeout(() => {
                this.subscribeToServer(context, serverLabel);
            }, 3000);

            if (this.getConfiguration().generalAutoOpenLogWindow) {
                const panelProvider: WebViewPanelProvider = new WebViewPanelProvider();
                const panelName: string = `OmniHive Log Viewer - ${serverLabel}`;

                if (!panelProvider.revealExistingPanel(panelName)) {
                    return;
                }

                panelProvider.generateNewPanel(context, "ohOpenLogWindow", panelName, VsCodeWebpanelRoute.LogViewer, {
                    registeredServers: this.registeredServers,
                    serverLabel: serverLabel,
                });
            }
        });

        socket.on(AdminEventType.RegisterResponse, (message: AdminResponse<{ verified: boolean }>) => {
            const server: RegisteredServerModel | undefined = this.registeredServers.find(
                (server: RegisteredServerModel) =>
                    server.label === serverLabel && server.serverGroupId === message.serverGroupId
            );

            if (IsHelper.isNullOrUndefined(server)) {
                return;
            }

            if (!message.requestComplete || IsHelper.isNullOrUndefined(message.data) || !message.data.verified) {
                server.status = ServerStatus.Error;
                this.extensionTreeProvider._onDidChangeTreeData.fire(undefined);
                return;
            }

            const eventRequest: AdminRequest = {
                adminPassword: server.adminPassword,
                serverGroupId: server.serverGroupId,
            };

            socket.emit(AdminEventType.StatusRequest, eventRequest);
        });

        socket.on(
            AdminEventType.StatusResponse,
            (message: AdminResponse<{ serverStatus: ServerStatus; serverError: any }>) => {
                const server: RegisteredServerModel | undefined = this.registeredServers.find(
                    (server: RegisteredServerModel) =>
                        server.label === serverLabel && server.serverGroupId === message.serverGroupId
                );

                if (IsHelper.isNullOrUndefined(server)) {
                    return;
                }

                const currentStatus: string = server.status;

                if (!message.requestComplete) {
                    if (currentStatus !== ServerStatus.Offline) {
                        server.status = ServerStatus.Offline;
                        this.extensionTreeProvider._onDidChangeTreeData.fire(undefined);
                    }
                    return;
                }

                server.status = message.data?.serverStatus ?? ServerStatus.Unknown;

                if (currentStatus !== server.status) {
                    socket.emit(AdminEventType.UrlListRequest, {
                        adminPassword: server.adminPassword,
                        serverGroupId: server.serverGroupId,
                    });
                    this.extensionTreeProvider._onDidChangeTreeData.fire(undefined);
                }
            }
        );

        socket.on(AdminEventType.UrlListResponse, (message: AdminResponse<{ urls: RegisteredUrl[] }>) => {
            const server: RegisteredServerModel | undefined = this.registeredServers.find(
                (server: RegisteredServerModel) =>
                    server.label === serverLabel && server.serverGroupId === message.serverGroupId
            );

            if (IsHelper.isNullOrUndefined(server)) {
                return;
            }

            if (!message.requestComplete) {
                server.urls = [];
                this.extensionTreeProvider._onDidChangeTreeData.fire(undefined);
                return;
            }

            server.urls = message.data?.urls ?? [];
            this.extensionTreeProvider._onDidChangeTreeData.fire(undefined);
        });

        socket.connect();
        this.registeredClients.push({ serverLabel, socket });
    };

    public unsubscribeFromServer = (serverLabel: string): void => {
        const client: RegisteredClientModel | undefined = this.registeredClients.find(
            (client: RegisteredClientModel) => client.serverLabel === serverLabel
        );

        if (IsHelper.isNullOrUndefined(client) || IsHelper.isNullOrUndefined(client.socket)) {
            return;
        }

        client.socket.off();
        client.socket.disconnect();
        client.socket = null;

        this.registeredClients = this.registeredClients.filter(
            (client: RegisteredClientModel) => client.serverLabel !== serverLabel
        );
    };
}
