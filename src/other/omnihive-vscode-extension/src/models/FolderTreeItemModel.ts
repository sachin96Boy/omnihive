import vscode from "vscode";

export class FolderTreeItemModel extends vscode.TreeItem {
    constructor(public readonly label: string, public readonly ohPath: string) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed);
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
        light: `${__filename}/../../../resources/images/folder.png`,
        dark: `${__filename}/../../../resources/images/folder.png`,
    };

    contextValue = "folderItem";
}
