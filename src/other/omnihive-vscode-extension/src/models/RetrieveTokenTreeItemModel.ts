import vscode from "vscode";
import { VsCodeCommand } from "../enums/VsCodeCommand";

export class RetrieveTokenTreeItemModel extends vscode.TreeItem {
    constructor(public readonly label: string, public readonly ohPath: string) {
        super(label, vscode.TreeItemCollapsibleState.None);
    }

    //@ts-ignore
    get command(): vscode.Command {
        return {
            command: VsCodeCommand.RetrieveToken,
            title: "Retrieve Token",
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
        light: `${__filename}/../../../resources/images/key.png`,
        dark: `${__filename}/../../../resources/images/key.png`,
    };

    contextValue = "retrieveToken";
}
