import vscode from "vscode";
import { VsCodeCommand } from "../enums/VsCodeCommand";

export class SwaggerTreeItemModel extends vscode.TreeItem {
    public swaggerJsonUrl: string = "";

    constructor(public readonly label: string, public readonly ohPath: string, swaggerJsonUrl: string) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.swaggerJsonUrl = swaggerJsonUrl;
    }

    //@ts-ignore
    get command(): vscode.Command {
        return {
            command: VsCodeCommand.SwaggerBrowser,
            title: "Swagger Browser",
            arguments: [this],
        };
    }

    // @ts-ignore
    get tooltip(): string {
        return this.label;
    }

    // @ts-ignore
    get description(): string {
        return "";
    }

    iconPath = {
        light: `${__filename}/../../../resources/images/swagger.png`,
        dark: `${__filename}/../../../resources/images/swagger.png`,
    };

    contextValue = "swaggerItem";
}
