import vscode from "vscode";
import { VsCodeCommand } from "../enums/VsCodeCommand";
import { VsCodeWebpanelRoute } from "../enums/VsCodeWebpanelRoute";
import { VsCodePostMessageModel } from "../models/VsCodePostMessageModel";
import { WebViewPanelProvider } from "../providers/WebViewPanelProvider";
import { ExtensionStore } from "../stores/ExtensionStore";

export class RetrieveTokenCommand {
    public setup = (context: vscode.ExtensionContext) => {
        const cmdOhAddServer = vscode.commands.registerCommand(VsCodeCommand.RetrieveToken, (args: any) => {
            const ohPath: string[] = ExtensionStore.getSingleton().getOhPath(args.ohPath);
            const serverLabel: string = ohPath[0];
            const panelName: string = `OmniHive Retrieve Token - ${serverLabel}`;
            const panelProvider: WebViewPanelProvider = new WebViewPanelProvider();

            if (!panelProvider.revealExistingPanel(panelName)) {
                return;
            }

            panelProvider.generateNewPanel(context, "ohRetrieveTokenPanel", panelName, VsCodeWebpanelRoute.RetrieveToken, {
                serverLabel,
            });
        });

        context.subscriptions.push(cmdOhAddServer);
    };
}
