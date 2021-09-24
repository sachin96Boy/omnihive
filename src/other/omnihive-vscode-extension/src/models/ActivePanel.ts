import vscode from "vscode";

export class ActivePanel {
    public panelName: string = "";
    public panel!: vscode.WebviewPanel;
}