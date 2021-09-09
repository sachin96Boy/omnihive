import { IsHelper, RegisteredUrl, ServerStatus } from "@withonevision/omnihive-core-cjs";
import orderBy from "lodash.orderby";
import vscode from "vscode";
import { EditServerEnvironmentTreeItemModel } from "../models/EditServerEnvironmentTreeItemModel";
import { EditServerWorkersTreeItemModel } from "../models/EditServerWorkersTreeItemModel";
import { FolderTreeItemModel } from "../models/FolderTreeItemModel";
import { GraphTreeItemModel } from "../models/GraphTreeItemModel";
import { InfoTreeItemModel } from "../models/InfoTreeItemModel";
import { LogTreeItemModel } from "../models/LogTreeItemModel";
import { RawEditorTreeItemModel } from "../models/RawEditorTreeItemModel";
import { RefreshSchemaTreeItemModel } from "../models/RefreshSchemaTreeItemModel";
import { RegisteredServerModel } from "../models/RegisteredServerModel";
import { RetrieveTokenTreeItemModel } from "../models/RetrieveTokenTreeItemModel";
import { ServerTreeItemModel } from "../models/ServerTreeItemModel";
import { StatusErrorTreeItemModel } from "../models/StatusErrorTreeItemModel";
import { StatusWarnTreeItemModel } from "../models/StatusWarnTreeItemModel";
import { SwaggerTreeItemModel } from "../models/SwaggerTreeItemModel";
import { ExtensionStore } from "../stores/ExtensionStore";

export class ExtensionTreeProvider implements vscode.TreeDataProvider<any> {
    // Implement event handlers
    _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
    onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;

    // Return item
    public getTreeItem = (element: any): vscode.TreeItem | Thenable<vscode.TreeItem> => {
        return element;
    };

    // Return children
    public getChildren = (element?: any): vscode.ProviderResult<any[]> => {
        // Root handler
        if (IsHelper.isUndefined(element)) {
            // Handle no server registrations in memory
            if (
                ExtensionStore.getSingleton().registeredServers &&
                ExtensionStore.getSingleton().registeredServers.length === 0
            ) {
                const emptyArray: InfoTreeItemModel[] = [];
                emptyArray.push(new InfoTreeItemModel("No OmniHive servers registered"));
                return Promise.resolve(emptyArray);
            }

            const servers: ServerTreeItemModel[] = [];

            orderBy(ExtensionStore.getSingleton().registeredServers, "label", "asc").forEach(
                (server: RegisteredServerModel) => {
                    servers.push(new ServerTreeItemModel(server.label, server.label, server.status));
                }
            );

            return Promise.resolve(servers);
        }

        if (element instanceof ServerTreeItemModel) {
            if (element.status === ServerStatus.Rebuilding) {
                return Promise.resolve([new InfoTreeItemModel("This server is rebuilding")]);
            }

            if (element.status === ServerStatus.Unknown) {
                return Promise.resolve([new InfoTreeItemModel("Please wait a moment")]);
            }

            if (element.status === ServerStatus.Offline) {
                return Promise.resolve([new InfoTreeItemModel("This server is offline")]);
            }

            if (element.status === ServerStatus.Error) {
                return Promise.resolve([new StatusErrorTreeItemModel("There is an error contacting this server")]);
            }

            return Promise.resolve(this.populateFolders(element));
        }

        if (element instanceof FolderTreeItemModel) {
            const folderPath: string = ExtensionStore.getSingleton().getOhPath(element.ohPath)[2];

            if (folderPath === "config") {
                return Promise.resolve(this.populateConfig(element));
            }

            if (folderPath === "tools") {
                return Promise.resolve(this.populateTools(element));
            }

            if (folderPath === "browsers") {
                return Promise.resolve(this.populateBrowsers(element));
            }
        }

        return Promise.resolve([]);
    };

    public populateBrowsers = async (element: any): Promise<any[]> => {
        const browserEndpoints: any = [];
        const serverLabel: string = ExtensionStore.getSingleton().getOhPath(element.ohPath)[0];

        const server: RegisteredServerModel = ExtensionStore.getSingleton().registeredServers.filter(
            (server: RegisteredServerModel) => server.label === serverLabel
        )[0];

        orderBy(server.urls, "path", "asc").forEach((url: RegisteredUrl) => {
            switch (url.type) {
                case "graphDatabase":
                    browserEndpoints.push(new GraphTreeItemModel(url.path, `${element.ohPath}||${url.path}`));
                    break;
                case "graphFunction":
                    browserEndpoints.push(new GraphTreeItemModel(url.path, `${element.ohPath}||${url.path}`));
                    break;
                case "swagger":
                    browserEndpoints.push(
                        new SwaggerTreeItemModel(
                            url.path,
                            `${element.ohPath}||${url.path}`,
                            url.metadata.swaggerJsonUrl
                        )
                    );
                    break;
            }
        });

        return browserEndpoints;
    };

    public populateConfig = async (element: any): Promise<any[]> => {
        const toolList: any[] = [];
        const ohPath: string[] = ExtensionStore.getSingleton().getOhPath(element.ohPath);

        toolList.push(
            new EditServerEnvironmentTreeItemModel("Server Environment", `${ohPath.join("||")}||serverEnvironment`)
        );
        toolList.push(new EditServerWorkersTreeItemModel("Server Workers", `${ohPath.join("||")}||serverWorkers`));
        toolList.push(new RawEditorTreeItemModel("Raw Configuration Editor", `${ohPath.join("||")}||rawEditor`));

        return toolList;
    };

    public populateFolders = async (element: any): Promise<any[]> => {
        const folders: FolderTreeItemModel | StatusWarnTreeItemModel[] = [];

        if (element.status === ServerStatus.Admin) {
            folders.push(new StatusWarnTreeItemModel("This server is in administrative mode"));
        }

        if (element.status !== ServerStatus.Admin) {
            folders.push(new FolderTreeItemModel("Browsers", `${element.ohPath}||${element.status}||browsers`));
        }

        folders.push(new FolderTreeItemModel("Configuration", `${element.ohPath}||${element.status}||config`));
        folders.push(new FolderTreeItemModel("Tools", `${element.ohPath}||${element.status}||tools`));

        return folders;
    };

    public populateTools = async (element: any): Promise<any[]> => {
        const toolList: any[] = [];
        const ohPath: string[] = ExtensionStore.getSingleton().getOhPath(element.ohPath);
        const status: ServerStatus = ohPath[1] as ServerStatus;

        toolList.push(new LogTreeItemModel("Log Viewer", `${ohPath.join("||")}||log`));
        toolList.push(new RefreshSchemaTreeItemModel("Refresh Schema", `${ohPath.join("||")}||refreshSchema`));

        if (status !== ServerStatus.Admin) {
            toolList.push(new RetrieveTokenTreeItemModel("Retrieve Token", `${ohPath.join("||")}||retrieveToken`));
        }

        return toolList;
    };
}
