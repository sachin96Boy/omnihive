import vscode from "vscode";
import { VsCodeCommand } from "../enums/VsCodeCommand";
import { ExtensionStore } from "../stores/ExtensionStore";

export class ReconnectCommand {
    public setup = (context: vscode.ExtensionContext) => {
        const cmdOhReconnect = vscode.commands.registerCommand(VsCodeCommand.Reconnect, async (args: any) => {
            const ohPath: string[] = ExtensionStore.getSingleton().getOhPath(args.ohPath);
            const serverLabel: string = ohPath[0];
            ExtensionStore.getSingleton().subscribeToServer(context, serverLabel, true);
        });

        // Push refresh command into subscriptions
        context.subscriptions.push(cmdOhReconnect);
    };
}
