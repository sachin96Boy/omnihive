import vscode from "vscode";

export class InfoTreeItemModel extends vscode.TreeItem {
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
        light: `${__filename}/../../../resources/images/info.png`,
        dark: `${__filename}/../../../resources/images/info.png`,
    };

    contextValue = "infoItem";
}
