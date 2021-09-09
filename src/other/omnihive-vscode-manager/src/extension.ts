import { IsHelper, ServerStatus } from "@withonevision/omnihive-core-cjs";
import vscode from "vscode";
import { AddServerCommand } from "./commands/AddServerCommand";
import { EditServerCommand } from "./commands/EditServerCommand";
import { EditServerEnvironmentCommand } from "./commands/EditServerEnvironmentCommand";
import { EditServerWorkersCommand } from "./commands/EditServerWorkersCommand";
import { GraphBrowserCommand } from "./commands/GraphBrowserCommand";
import { LogViewerCommand } from "./commands/LogViewerCommand";
import { RawEditorCommand } from "./commands/RawEditorCommand";
import { ReconnectCommand } from "./commands/ReconnectCommand";
import { RefreshSchemaCommand } from "./commands/RefreshSchemaCommand";
import { RemoveAllServersCommand } from "./commands/RemoveAllServersCommand";
import { RemoveServerCommand } from "./commands/RemoveServerCommand";
import { RetrieveTokenCommand } from "./commands/RetrieveTokenCommand";
import { SwaggerBrowserCommand } from "./commands/SwaggerBrowserCommand";
import { RegisteredServerModel } from "./models/RegisteredServerModel";
import { ExtensionTreeProvider } from "./providers/ExtensionTreeProvider";
import { ExtensionStore } from "./stores/ExtensionStore";

export const activate = (context: vscode.ExtensionContext) => {
    /******************* SETUP *******************/

    // Register account tree
    ExtensionStore.getSingleton().extensionTreeProvider = new ExtensionTreeProvider();
    vscode.window.registerTreeDataProvider("ohServers", ExtensionStore.getSingleton().extensionTreeProvider);

    // Get servers
    const servers: RegisteredServerModel[] | undefined =
        context.globalState.get<RegisteredServerModel[]>("oh:registeredServers");

    if (!IsHelper.isNullOrUndefined(servers) && IsHelper.isArray(servers) && servers.length > 0) {
        for (const server of servers) {
            server.status = ServerStatus.Unknown;
        }
    }

    /******************* COMMANDS *******************/

    //////// Add Server
    const addServerCommand: AddServerCommand = new AddServerCommand();
    addServerCommand.setup(context);

    //////// Edit Server
    const editServerCommand: EditServerCommand = new EditServerCommand();
    editServerCommand.setup(context);

    //////// Edit Server Environment
    const editServerEnvironmentCommand: EditServerEnvironmentCommand = new EditServerEnvironmentCommand();
    editServerEnvironmentCommand.setup(context);

    //////// Edit Server Workers
    const editServerWorkersCommand: EditServerWorkersCommand = new EditServerWorkersCommand();
    editServerWorkersCommand.setup(context);

    //////// Graph Browser
    const graphBrowserCommand: GraphBrowserCommand = new GraphBrowserCommand();
    graphBrowserCommand.setup(context);

    //////// Log Viewer
    const logViewerCommand: LogViewerCommand = new LogViewerCommand();
    logViewerCommand.setup(context);

    //////// Raw Editor
    const rawEditorCommand: RawEditorCommand = new RawEditorCommand();
    rawEditorCommand.setup(context);

    //////// Reconnect To Server
    const reconnectCommand: ReconnectCommand = new ReconnectCommand();
    reconnectCommand.setup(context);

    //////// Refresh Schema
    const refreshSchemaCommand: RefreshSchemaCommand = new RefreshSchemaCommand();
    refreshSchemaCommand.setup(context);

    //////// Remove Server
    const removeServerCommand: RemoveServerCommand = new RemoveServerCommand();
    removeServerCommand.setup(context);

    //////// Remove All Servers
    const removeAllServersCommand: RemoveAllServersCommand = new RemoveAllServersCommand();
    removeAllServersCommand.setup(context);

    //////// Retrieve Token
    const retrieveTokenCommand: RetrieveTokenCommand = new RetrieveTokenCommand();
    retrieveTokenCommand.setup(context);

    //////// Swagger Browser
    const swaggerBrowserCommand: SwaggerBrowserCommand = new SwaggerBrowserCommand();
    swaggerBrowserCommand.setup(context);

    /******************* INITIALIZE *******************/

    ExtensionStore.getSingleton().registeredClients = [];

    if (IsHelper.isUndefined(servers)) {
        ExtensionStore.getSingleton().registeredServers = [];
    } else {
        servers.forEach((server: RegisteredServerModel) => {
            ExtensionStore.getSingleton().addServer(context, server);
        });
    }

    ExtensionStore.getSingleton().extensionTreeProvider._onDidChangeTreeData.fire(undefined);
};

export const deactivate = () => {
    ExtensionStore.getSingleton().registeredServers.forEach((server: RegisteredServerModel) => {
        ExtensionStore.getSingleton().unsubscribeFromServer(server.label);
    });

    ExtensionStore.getSingleton().registeredClients = [];
    ExtensionStore.getSingleton().registeredServers = [];
};
