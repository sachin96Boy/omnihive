import vscode from "vscode";
import { VsCodeCommand } from "../enums/VsCodeCommand";
import { WebViewPanelProvider } from "../providers/WebViewPanelProvider";
import { ExtensionStore } from "../stores/ExtensionStore";
import { VsCodeWebpanelRoute } from "../enums/VsCodeWebpanelRoute";

export class LogViewerCommand {
    public setup = (context: vscode.ExtensionContext) => {
        const cmdOhLogViewer = vscode.commands.registerCommand(VsCodeCommand.LogViewer, (args: any) => {
            const panelProvider: WebViewPanelProvider = new WebViewPanelProvider();
            const ohPath: string[] = ExtensionStore.getSingleton().getOhPath(args.ohPath);
            const serverLabel: string = ohPath[0];
            const panelName: string = `OmniHive Log Viewer - ${serverLabel}`;

            if (!panelProvider.revealExistingPanel(panelName)) {
                return;
            }

            panelProvider.generateNewPanel(context, "ohLogViewer", panelName, VsCodeWebpanelRoute.LogViewer, {
                serverLabel: serverLabel,
            });
        });

        // Push add account command into subscriptions
        context.subscriptions.push(cmdOhLogViewer);
    };
}
