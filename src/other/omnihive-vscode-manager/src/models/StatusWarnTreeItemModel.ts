import vscode from "vscode";

export class StatusWarnTreeItemModel extends vscode.TreeItem {
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
        light: `${__filename}/../../../resources/images/warning.png`,
        dark: `${__filename}/../../../resources/images/warning.png`,
    };

    contextValue = "statusWarnItem";
}
