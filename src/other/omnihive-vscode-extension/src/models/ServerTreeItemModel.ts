import { ServerStatus } from "@withonevision/omnihive-core-cjs/enums/ServerStatus";
import vscode from "vscode";

export class ServerTreeItemModel extends vscode.TreeItem {
    private readonly iconColor: string = "grey";

    constructor(public readonly label: string, public readonly ohPath: string, public readonly status: ServerStatus) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed);

        this.contextValue = `serverItem-${this.status}`;

        switch (status) {
            case ServerStatus.Unknown:
                this.iconColor = "grey";
                break;
            case ServerStatus.Error:
            case ServerStatus.Offline:
                this.iconColor = "red";
                this.contextValue = this.contextValue + "-allowReconnect";
                break;
            case ServerStatus.Online:
                this.iconColor = "green";
                break;
            case ServerStatus.Rebuilding:
                this.iconColor = "yellow";
                this.contextValue = this.contextValue + "-allowLog";
                break;
            case ServerStatus.Admin:
                this.iconColor = "orange";
                this.contextValue = this.contextValue + "-allowRefresh";
                this.contextValue = this.contextValue + "-allowLog";
                break;
            default:
                this.iconColor = "grey";
                break;
        }

        this.iconPath = {
            light: `${__filename}/../../../resources/images/bee-server-${this.iconColor}.png`,
            dark: `${__filename}/../../../resources/images/bee-server-${this.iconColor}.png`,
        };
    }

    // @ts-ignore
    get tooltip(): string {
        return `${this.label}`;
    }

    // @ts-ignore
    get description(): string {
        return "";
    }
}
