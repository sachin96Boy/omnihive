import { EditorMarkupFormat } from "../enums/EditorMarkupFormat";

export class ExtensionConfiguration {
    public generalAlertErrorTimeout: number = 10000;
    public generalAlertSuccessTimeout: number = 2000;
    public generalAutoCloseSettings: boolean = false;
    public generalAutoOpenLogWindow: boolean = false;
    public generalAutoRefreshServer: boolean = false;
    public generalEditorMarkupFormat: EditorMarkupFormat = EditorMarkupFormat.JSON;
    public stylesGraphBrowser: string = "";
    public stylesSwaggerBrowser: string = "";
    public stylesWebPanelBackgroundColorHex: string = "#1E1E1E";
}
