import vscode from "vscode";
import { VsCodeCommand } from "../enums/VsCodeCommand";
import { ExtensionStore } from "../stores/ExtensionStore";

export class RefreshSchemaCommand {
    public setup = (context: vscode.ExtensionContext) => {
        const cmdOhSchemaRefresh = vscode.commands.registerCommand(VsCodeCommand.RefreshSchema, async (args: any) => {
            const refreshSchemaMessageItems: vscode.MessageItem[] = [
                {
                    title: "Confirm",
                },
                {
                    title: "Cancel",
                    isCloseAffordance: true,
                },
            ];

            const confirm: vscode.MessageItem | undefined = await vscode.window.showWarningMessage(
                "Confirm you want to refresh the schema",
                { modal: true },
                ...refreshSchemaMessageItems
            );

            if (!confirm || confirm?.title === "Cancel") {
                return;
            }

            const ohPath: string[] = ExtensionStore.getSingleton().getOhPath(args.ohPath);
            const serverLabel: string = ohPath[0];
            ExtensionStore.getSingleton().refreshSchema(serverLabel);
        });

        // Push refresh command into subscriptions
        context.subscriptions.push(cmdOhSchemaRefresh);
    };
}
