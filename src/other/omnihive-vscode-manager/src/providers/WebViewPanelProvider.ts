import { IsHelper, StringBuilder } from "@withonevision/omnihive-core-cjs";
import vscode from "vscode";
import { VsCodeWebpanelRoute } from "../enums/VsCodeWebpanelRoute";
import { ActivePanel } from "../models/ActivePanel";
import { ExtensionStore } from "../stores/ExtensionStore";

export class WebViewPanelProvider {
    public generateNewPanel = (
        context: vscode.ExtensionContext,
        viewType: string,
        title: string,
        webpanelRoute: VsCodeWebpanelRoute,
        panelData?: any
    ): vscode.WebviewPanel => {
        const panel: vscode.WebviewPanel = vscode.window.createWebviewPanel(
            `${viewType}`,
            `${title}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            }
        );

        const beeDarkOnDiskPath = vscode.Uri.file(`${context.extensionPath}/resources/images/omnihive-bee-dark.png`);
        const beeDarkSrc = panel.webview.asWebviewUri(beeDarkOnDiskPath);

        const beeLightOnDiskPath = vscode.Uri.file(`${context.extensionPath}/resources/images/omnihive-bee-light.png`);
        const beeLightSrc = panel.webview.asWebviewUri(beeLightOnDiskPath);

        const beeLightGreenOnDiskPath = vscode.Uri.file(
            `${context.extensionPath}/resources/images/omnihive-bee-light-green.png`
        );
        const beeLightGreenSrc = panel.webview.asWebviewUri(beeLightGreenOnDiskPath);

        const beeLightGreyOnDiskPath = vscode.Uri.file(
            `${context.extensionPath}/resources/images/omnihive-bee-light-grey.png`
        );
        const beeLightGreySrc = panel.webview.asWebviewUri(beeLightGreyOnDiskPath);

        const beeLightOrangeOnDiskPath = vscode.Uri.file(
            `${context.extensionPath}/resources/images/omnihive-bee-light-orange.png`
        );
        const beeLightOrangeSrc = panel.webview.asWebviewUri(beeLightOrangeOnDiskPath);

        const beeLightRedOnDiskPath = vscode.Uri.file(
            `${context.extensionPath}/resources/images/omnihive-bee-light-red.png`
        );
        const beeLightRedSrc = panel.webview.asWebviewUri(beeLightRedOnDiskPath);

        const beeLightYellowOnDiskPath = vscode.Uri.file(
            `${context.extensionPath}/resources/images/omnihive-bee-light-yellow.png`
        );
        const beeLightYellowSrc = panel.webview.asWebviewUri(beeLightYellowOnDiskPath);

        const clipboardOnDiskPath = vscode.Uri.file(`${context.extensionPath}/resources/images/clipboard.png`);
        const clipboardSrc = panel.webview.asWebviewUri(clipboardOnDiskPath);

        const errorOnDiskPath = vscode.Uri.file(`${context.extensionPath}/resources/images/error.png`);
        const errorSrc = panel.webview.asWebviewUri(errorOnDiskPath);

        const keyOnDiskPath = vscode.Uri.file(`${context.extensionPath}/resources/images/key.png`);
        const keySrc = panel.webview.asWebviewUri(keyOnDiskPath);

        const pauseOnDiskPath = vscode.Uri.file(`${context.extensionPath}/resources/images/pause.png`);
        const pauseSrc = panel.webview.asWebviewUri(pauseOnDiskPath);

        const playOnDiskPath = vscode.Uri.file(`${context.extensionPath}/resources/images/play.png`);
        const playSrc = panel.webview.asWebviewUri(playOnDiskPath);

        const spinnerOnDiskPath = vscode.Uri.file(`${context.extensionPath}/resources/images/spinner.png`);
        const spinnerSrc = panel.webview.asWebviewUri(spinnerOnDiskPath);

        const successOnDiskPath = vscode.Uri.file(`${context.extensionPath}/resources/images/success.png`);
        const successSrc = panel.webview.asWebviewUri(successOnDiskPath);

        const trashOnDiskPath = vscode.Uri.file(`${context.extensionPath}/resources/images/trash-white.png`);
        const trashSrc = panel.webview.asWebviewUri(trashOnDiskPath);

        const uploadOnDiskPath = vscode.Uri.file(`${context.extensionPath}/resources/images/upload.png`);
        const uploadSrc = panel.webview.asWebviewUri(uploadOnDiskPath);

        const warningOnDiskPath = vscode.Uri.file(`${context.extensionPath}/resources/images/warning.png`);
        const warningSrc = panel.webview.asWebviewUri(warningOnDiskPath);

        panel.iconPath = vscode.Uri.file(`${context.extensionPath}/resources/images/favicon.png`);

        if (webpanelRoute === VsCodeWebpanelRoute.SwaggerBrowser) {
            const webViewContent: StringBuilder = new StringBuilder();

            webViewContent.appendLine(`<!DOCTYPE html>`);
            webViewContent.appendLine(`<html lang="en">`);
            webViewContent.appendLine(`<head>`);
            webViewContent.appendLine(`\t<meta charset="UTF-8">`);
            webViewContent.appendLine(`\t<title>Swagger UI</title>`);
            webViewContent.appendLine(
                `\t<link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css">`
            );
            webViewContent.appendLine(`\t<style>`);
            webViewContent.appendLine(`\t\thtml`);
            webViewContent.appendLine(`\t\t\t{`);
            webViewContent.appendLine(`\t\t\t\tbox-sizing: border-box;`);
            webViewContent.appendLine(`\t\t\t\toverflow: -moz-scrollbars-vertical;`);
            webViewContent.appendLine(`\t\t\t\toverflow-y: scroll;`);
            webViewContent.appendLine(`\t\t\t}`);
            webViewContent.appendLine();
            webViewContent.appendLine(`\t\t*,`);
            webViewContent.appendLine(`\t\t*:before,`);
            webViewContent.appendLine(`\t\t*:after`);
            webViewContent.appendLine(`\t\t\t{`);
            webViewContent.appendLine(`\t\t\t\tbox-sizing: inherit;`);
            webViewContent.appendLine(`\t\t\t}`);
            webViewContent.appendLine();
            webViewContent.appendLine(`\t\tbody`);
            webViewContent.appendLine(`\t\t\t{`);
            webViewContent.appendLine(`\t\t\t\tmargin:0;`);
            webViewContent.appendLine(`\t\t\t\tbackground: #fafafa;`);
            webViewContent.appendLine(`\t\t\t}`);
            webViewContent.appendLine(`\t</style>`);

            if (
                !IsHelper.isEmptyStringOrWhitespace(
                    ExtensionStore.getSingleton().getConfiguration().stylesSwaggerBrowser
                )
            ) {
                webViewContent.appendLine(
                    `\t<link rel="stylesheet" type="text/css" href="${
                        ExtensionStore.getSingleton().getConfiguration().stylesSwaggerBrowser
                    }">`
                );
            }

            webViewContent.appendLine(`</head>`);
            webViewContent.appendLine();
            webViewContent.appendLine(`<body>`);
            webViewContent.appendLine(
                `\t<div id="topbar" style="padding-top: 10px; border-bottom: 1px solid; padding-bottom: 10px;">`
            );
            webViewContent.appendLine(
                `\t\t<img style="height:50px;" src="https://static1.smartbear.co/swagger/media/assets/images/swagger_logo.svg" alt="swagger" />`
            );
            webViewContent.appendLine(`\t</div>`);
            webViewContent.appendLine(`\t<div id="swagger-ui"></div>`);
            webViewContent.appendLine(
                `\t<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@3.45.0/swagger-ui-standalone-preset.min.js"></script>`
            );
            webViewContent.appendLine(
                `\t<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@3.45.0/swagger-ui-bundle.min.js" charset="UTF-8"></script>`
            );
            webViewContent.appendLine(`\t<script>`);
            webViewContent.appendLine(`\t\twindow.onload = function() {`);
            webViewContent.appendLine(`\t\t\tconst ui = SwaggerUIBundle({`);
            webViewContent.appendLine(`\t\t\t\turl: "${panelData.swaggerJsonUrl}",`);
            webViewContent.appendLine(`\t\t\t\tdom_id: '#swagger-ui',`);
            webViewContent.appendLine(`\t\t\t\tdeepLinking: true,`);
            webViewContent.appendLine(`\t\t\t\tpresets: [`);
            webViewContent.appendLine(`\t\t\t\t\tSwaggerUIBundle.presets.apis,`);
            webViewContent.appendLine(`\t\t\t\t\tSwaggerUIStandalonePreset`);
            webViewContent.appendLine(`\t\t\t\t],`);
            webViewContent.appendLine(`\t\t\t\tplugins: [`);
            webViewContent.appendLine(`\t\t\t\t\tSwaggerUIBundle.plugins.DownloadUrl`);
            webViewContent.appendLine(`\t\t\t\t],`);
            webViewContent.appendLine(`\t\t\t});`);
            webViewContent.appendLine(`\t\t\twindow.ui = ui;`);
            webViewContent.appendLine(`\t\t};`);
            webViewContent.appendLine(`\t</script>`);
            webViewContent.appendLine(`</body>`);
            webViewContent.appendLine(`</html>`);

            panel.webview.html = webViewContent.outputString();
        } else {
            const reactAdminPathOnDisk = vscode.Uri.file(`${context.extensionPath}/out/reactAdmin.js`);
            const reactAdminUri = reactAdminPathOnDisk.with({ scheme: "vscode-resource" });

            const webViewContent: StringBuilder = new StringBuilder();

            webViewContent.appendLine(`<!DOCTYPE html>`);
            webViewContent.appendLine(`<html lang="en" class="w-full h-full">`);
            webViewContent.appendLine(`<head>`);
            webViewContent.appendLine(`\t<meta charset="UTF-8">`);
            webViewContent.appendLine(`\t<meta name="viewport" content="width=device-width, initial-scale=1.0">`);
            webViewContent.appendLine(`\t<meta http-equiv="Content-Security-Policy" content="">`);
            webViewContent.appendLine(`\t<title>OmniHive Administrator</title>`);
            webViewContent.appendLine(`\t<script>`);
            webViewContent.appendLine(`\t\twindow.acquireVsCodeApi = acquireVsCodeApi;`);
            webViewContent.appendLine(
                `\t\twindow.extensionConfiguration = \`${JSON.stringify(
                    ExtensionStore.getSingleton().getConfiguration()
                )}\`;`
            );
            webViewContent.appendLine(
                `\t\twindow.registeredServers = \`${JSON.stringify(ExtensionStore.getSingleton().registeredServers)}\``
            );
            webViewContent.appendLine(`\t\twindow.imageSources = {`);
            webViewContent.appendLine(`\t\t\tbeeDark: "${beeDarkSrc}",`);
            webViewContent.appendLine(`\t\t\tbeeLight: "${beeLightSrc}",`);
            webViewContent.appendLine(`\t\t\tbeeLightGreen: "${beeLightGreenSrc}",`);
            webViewContent.appendLine(`\t\t\tbeeLightGrey: "${beeLightGreySrc}",`);
            webViewContent.appendLine(`\t\t\tbeeLightOrange: "${beeLightOrangeSrc}",`);
            webViewContent.appendLine(`\t\t\tbeeLightRed: "${beeLightRedSrc}",`);
            webViewContent.appendLine(`\t\t\tbeeLightYellow: "${beeLightYellowSrc}",`);
            webViewContent.appendLine(`\t\t\tclipboard: "${clipboardSrc}",`);
            webViewContent.appendLine(`\t\t\terror: "${errorSrc}",`);
            webViewContent.appendLine(`\t\t\tkey: "${keySrc}",`);
            webViewContent.appendLine(`\t\t\tpause: "${pauseSrc}",`);
            webViewContent.appendLine(`\t\t\tplay: "${playSrc}",`);
            webViewContent.appendLine(`\t\t\tspinner: "${spinnerSrc}",`);
            webViewContent.appendLine(`\t\t\tsuccess: "${successSrc}",`);
            webViewContent.appendLine(`\t\t\ttrash: "${trashSrc}",`);
            webViewContent.appendLine(`\t\t\tupload: "${uploadSrc}",`);
            webViewContent.appendLine(`\t\t\twarning: "${warningSrc}",`);
            webViewContent.appendLine(`\t\t};`);
            if (!IsHelper.isNullOrUndefined(panelData)) {
                webViewContent.appendLine(`\t\twindow.panelData = \`${JSON.stringify(panelData)}\`;`);
            } else {
                webViewContent.appendLine(`\t\twindow.panelData = "";`);
            }

            webViewContent.appendLine(`\t\twindow.webpanelRoute = "${webpanelRoute}";`);
            webViewContent.appendLine(`\t</script>`);
            webViewContent.appendLine(`\t<link rel="stylesheet" href="https://use.typekit.net/auk3lqn.css">`);
            webViewContent.appendLine(
                `\t<link href="https://cdn.jsdelivr.net/npm/graphiql@1.4.0/graphiql.min.css" rel="stylesheet" />`
            );

            if (
                !IsHelper.isEmptyStringOrWhitespace(
                    ExtensionStore.getSingleton().getConfiguration().stylesGraphBrowser
                ) &&
                webpanelRoute === VsCodeWebpanelRoute.GraphBrowser
            ) {
                webViewContent.appendLine(
                    `\t<link rel="stylesheet" type="text/css" href="${
                        ExtensionStore.getSingleton().getConfiguration().stylesGraphBrowser
                    }">`
                );
            }

            webViewContent.appendLine(`</head>`);
            webViewContent.appendLine(`<body class="w-full h-full">`);
            webViewContent.appendLine(`\t<div id="root" class="w-full h-full"></div>`);
            webViewContent.appendLine(`\t<script src="${reactAdminUri}"></script>`);
            webViewContent.appendLine(`</body>`);
            webViewContent.appendLine(`</html>`);

            panel.webview.html = webViewContent.outputString();
        }

        panel.onDidDispose(() => {
            ExtensionStore.getSingleton().activePanels = ExtensionStore.getSingleton().activePanels.filter(
                (activePanel: ActivePanel) => {
                    return activePanel.panelName !== title;
                }
            );
        });

        ExtensionStore.getSingleton().activePanels.push({ panelName: title, panel });

        return panel;
    };

    public revealExistingPanel = (panelName: string): boolean => {
        let exists: boolean = false;

        ExtensionStore.getSingleton().activePanels.forEach((activePanel: ActivePanel) => {
            if (activePanel.panelName === panelName) {
                activePanel.panel.reveal();
                exists = true;
            }
        });

        if (exists) {
            return false;
        }

        return true;
    };
}
