import vscode from "vscode";
import { VsCodeCommand } from "../enums/VsCodeCommand";
import { VsCodeWebpanelRoute } from "../enums/VsCodeWebpanelRoute";
import { VsCodePostMessageModel } from "../models/VsCodePostMessageModel";
import { WebViewPanelProvider } from "../providers/WebViewPanelProvider";
import { ExtensionStore } from "../stores/ExtensionStore";

export class RawEditorCommand {
    public setup = (context: vscode.ExtensionContext) => {
        const cmdOhRawEditor = vscode.commands.registerCommand(VsCodeCommand.RawEditor, (args: any) => {
            const ohPath: string[] = ExtensionStore.getSingleton().getOhPath(args.ohPath);
            const serverLabel: string = ohPath[0];
            const panelName: string = `OmniHive Raw Editor - ${serverLabel}`;
            const panelProvider: WebViewPanelProvider = new WebViewPanelProvider();

            if (!panelProvider.revealExistingPanel(panelName)) {
                return;
            }

            const panel: vscode.WebviewPanel = panelProvider.generateNewPanel(context, "ohRawEditorPanel", panelName, VsCodeWebpanelRoute.RawEditor, {
                serverLabel,
            });

            panel.webview.onDidReceiveMessage((message: VsCodePostMessageModel) => {
                if (message.command === VsCodeCommand.RawEditor && message.data && message.data.settings) {
                    const refresh: boolean = ExtensionStore.getSingleton().refreshSchema(serverLabel);

                    if (!ExtensionStore.getSingleton().getConfiguration().generalAutoRefreshServer || !refresh) {
                        return;
                    }

                    const logPanelName: string = `OmniHive Log Viewer - ${serverLabel}`;

                    if (!panelProvider.revealExistingPanel(logPanelName)) {
                        return;
                    }

                    panelProvider.generateNewPanel(context, "ohOpenLogWindow", logPanelName, VsCodeWebpanelRoute.LogViewer, {
                        serverLabel: serverLabel,
                    });

                    if (ExtensionStore.getSingleton().getConfiguration().generalAutoCloseSettings) {
                        panel.dispose();
                    }
                }
            });
        });

        context.subscriptions.push(cmdOhRawEditor);
    };
}
