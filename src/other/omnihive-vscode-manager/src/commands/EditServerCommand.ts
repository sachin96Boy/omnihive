import vscode from "vscode";
import { VsCodeCommand } from "../enums/VsCodeCommand";
import { VsCodeWebpanelRoute } from "../enums/VsCodeWebpanelRoute";
import { RegisteredServerModel } from "../models/RegisteredServerModel";
import { VsCodePostMessageModel } from "../models/VsCodePostMessageModel";
import { WebViewPanelProvider } from "../providers/WebViewPanelProvider";
import { ExtensionStore } from "../stores/ExtensionStore";

export class EditServerCommand {
    public setup = (context: vscode.ExtensionContext) => {
        const cmdOhEditServer = vscode.commands.registerCommand(VsCodeCommand.EditServer, (args: any) => {
            const ohPath: string[] = ExtensionStore.getSingleton().getOhPath(args.ohPath);
            const serverLabel: string = ohPath[0];
            const panelName: string = `OmniHive Edit Server - ${serverLabel}`;
            const panelProvider: WebViewPanelProvider = new WebViewPanelProvider();

            if (!panelProvider.revealExistingPanel(panelName)) {
                return;
            }

            const panel: vscode.WebviewPanel = panelProvider.generateNewPanel(
                context,
                "ohEditServerPanel",
                panelName,
                VsCodeWebpanelRoute.EditServer,
                {
                    mode: "edit",
                    editServerLabel: serverLabel,
                }
            );

            panel.webview.onDidReceiveMessage((message: VsCodePostMessageModel) => {
                if (
                    message.command === VsCodeCommand.EditServer &&
                    message.data &&
                    message.data.registeredServer &&
                    message.data.oldServerLabel
                ) {
                    const registeredServer: RegisteredServerModel = message.data
                        .registeredServer as RegisteredServerModel;
                    const oldServerLabel: string = message.data.oldServerLabel as string;
                    ExtensionStore.getSingleton().editServer(context, oldServerLabel, registeredServer);
                    panel.dispose();
                    vscode.window.showInformationMessage(
                        `OmniHive Server ${registeredServer.label} Edited Successfully`,
                        { modal: true }
                    );
                }
            });
        });

        context.subscriptions.push(cmdOhEditServer);
    };
}
