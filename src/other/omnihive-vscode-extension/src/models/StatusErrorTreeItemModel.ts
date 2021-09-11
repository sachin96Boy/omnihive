import vscode from "vscode";

export class StatusErrorTreeItemModel extends vscode.TreeItem {
    public readonly ohPath: string = "";

    constructor(public readonly label: string) {
        super(label, vscode.TreeItemCollapsibleState.None);
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
        light: `${__filename}/../../../resources/images/error.png`,
        dark: `${__filename}/../../../resources/images/error.png`,
    };

    contextValue = "statusErrorItem";
}
