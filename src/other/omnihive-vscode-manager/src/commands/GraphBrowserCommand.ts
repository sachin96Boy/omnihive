import vscode from "vscode";
import { VsCodeCommand } from "../enums/VsCodeCommand";
import { VsCodeWebpanelRoute } from "../enums/VsCodeWebpanelRoute";
import { GraphTreeItemModel } from "../models/GraphTreeItemModel";
import { WebViewPanelProvider } from "../providers/WebViewPanelProvider";
import { ExtensionStore } from "../stores/ExtensionStore";

export class GraphBrowserCommand {
    public setup = (context: vscode.ExtensionContext) => {
        const cmdOhGraphBrowser = vscode.commands.registerCommand(VsCodeCommand.GraphBrowser, (args: GraphTreeItemModel) => {
            const panelProvider: WebViewPanelProvider = new WebViewPanelProvider();
            const ohPath: string[] = ExtensionStore.getSingleton().getOhPath(args.ohPath);
            const serverLabel: string = ohPath[0];
            const graphUrl: string = ohPath[3];
            const panelName: string = `Graph Browser - ${graphUrl}`;

            if (!panelProvider.revealExistingPanel(panelName)) {
                return;
            }

            panelProvider.generateNewPanel(context, "ohGraphBrowserPanel", panelName, VsCodeWebpanelRoute.GraphBrowser, {
                graphUrl: graphUrl,
                serverLabel,
            });
        });

        context.subscriptions.push(cmdOhGraphBrowser);
    };
}
