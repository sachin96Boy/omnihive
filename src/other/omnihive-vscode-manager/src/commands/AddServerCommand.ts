import vscode from "vscode";
import { VsCodeCommand } from "../enums/VsCodeCommand";
import { VsCodeWebpanelRoute } from "../enums/VsCodeWebpanelRoute";
import { RegisteredServerModel } from "../models/RegisteredServerModel";
import { VsCodePostMessageModel } from "../models/VsCodePostMessageModel";
import { WebViewPanelProvider } from "../providers/WebViewPanelProvider";
import { ExtensionStore } from "../stores/ExtensionStore";

export class AddServerCommand {
    public setup = (context: vscode.ExtensionContext) => {
        const cmdOhAddServer = vscode.commands.registerCommand(VsCodeCommand.AddServer, () => {
            const panelProvider: WebViewPanelProvider = new WebViewPanelProvider();
            const panelName: string = "OmniHive Add Server";

            if (!panelProvider.revealExistingPanel(panelName)) {
                return;
            }

            const panel: vscode.WebviewPanel = panelProvider.generateNewPanel(
                context,
                "ohAddServerPanel",
                panelName,
                VsCodeWebpanelRoute.AddServer,
                {
                    mode: "add",
                    editServerLabel: "",
                }
            );

            panel.webview.onDidReceiveMessage((message: VsCodePostMessageModel) => {
                if (message.command === VsCodeCommand.AddServer && message.data && message.data.registeredServer) {
                    const registeredServer: RegisteredServerModel = message.data
                        .registeredServer as RegisteredServerModel;
                    ExtensionStore.getSingleton().addServer(context, registeredServer);
                    panel.dispose();
                    vscode.window.showInformationMessage(
                        `OmniHive Server ${registeredServer.label} Added Successfully`,
                        { modal: true }
                    );
                }
            });
        });

        context.subscriptions.push(cmdOhAddServer);
    };
}
