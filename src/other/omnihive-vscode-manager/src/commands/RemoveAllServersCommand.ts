import vscode from "vscode";
import { VsCodeCommand } from "../enums/VsCodeCommand";
import { ExtensionStore } from "../stores/ExtensionStore";

export class RemoveAllServersCommand {
    public setup = (context: vscode.ExtensionContext) => {
        const removeAllServersMessageItems: vscode.MessageItem[] = [
            {
                title: "OK",
            },
            {
                title: "Cancel",
                isCloseAffordance: true,
            },
        ];

        const cmdOhRemoveAllServers = vscode.commands.registerCommand(VsCodeCommand.RemoveAllServers, () => {
            vscode.window
                .showWarningMessage(
                    "Are you sure you want to remove all servers?",
                    { modal: true },
                    ...removeAllServersMessageItems
                )
                .then((value: vscode.MessageItem | undefined) => {
                    if (value?.title === "OK") {
                        ExtensionStore.getSingleton().removeAllServers(context);
                        vscode.window.showInformationMessage("All OmniHive Servers Removed", { modal: true });
                    } else {
                        return;
                    }
                });
        });

        context.subscriptions.push(cmdOhRemoveAllServers);
    };
}
