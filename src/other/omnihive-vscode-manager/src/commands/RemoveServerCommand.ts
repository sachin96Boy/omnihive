import vscode from "vscode";
import { VsCodeCommand } from "../enums/VsCodeCommand";
import { ExtensionStore } from "../stores/ExtensionStore";

export class RemoveServerCommand {
    public setup = (context: vscode.ExtensionContext) => {
        const removeServerMessageItems: vscode.MessageItem[] = [
            {
                title: "OK",
            },
            {
                title: "Cancel",
                isCloseAffordance: true,
            },
        ];

        const cmdOhRemoveServer = vscode.commands.registerCommand(VsCodeCommand.RemoveServer, (args: any) => {
            const ohPath: string[] = ExtensionStore.getSingleton().getOhPath(args.ohPath);
            const serverLabel: string = ohPath[0];

            vscode.window
                .showWarningMessage(
                    `Are you sure you want to remove the server ${args.label}?`,
                    { modal: true },
                    ...removeServerMessageItems
                )
                .then((value: vscode.MessageItem | undefined) => {
                    if (value?.title === "OK") {
                        ExtensionStore.getSingleton().removeServer(context, serverLabel);
                        vscode.window.showInformationMessage(`OmniHive Server ${args.label} Removed Successfully`, {
                            modal: true,
                        });
                    } else {
                        return;
                    }
                });
        });

        context.subscriptions.push(cmdOhRemoveServer);
    };
}
