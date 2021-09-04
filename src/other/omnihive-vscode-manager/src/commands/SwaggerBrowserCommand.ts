import vscode from "vscode";
import { VsCodeCommand } from "../enums/VsCodeCommand";
import { VsCodeWebpanelRoute } from "../enums/VsCodeWebpanelRoute";
import { SwaggerTreeItemModel } from "../models/SwaggerTreeItemModel";
import { WebViewPanelProvider } from "../providers/WebViewPanelProvider";
import { ExtensionStore } from "../stores/ExtensionStore";

export class SwaggerBrowserCommand {
    public setup = (context: vscode.ExtensionContext) => {
        const cmdOhSwagger = vscode.commands.registerCommand(
            VsCodeCommand.SwaggerBrowser,
            (args: SwaggerTreeItemModel) => {
                const panelProvider: WebViewPanelProvider = new WebViewPanelProvider();
                const swaggerUrl: string = ExtensionStore.getSingleton().getOhPath(args.ohPath)[2];
                const panelName: string = `Swagger Browser - ${swaggerUrl}`;

                if (!panelProvider.revealExistingPanel(panelName)) {
                    return;
                }

                panelProvider.generateNewPanel(
                    context,
                    "ohSwaggerBrowserPanel",
                    panelName,
                    VsCodeWebpanelRoute.SwaggerBrowser,
                    {
                        swaggerUrl: swaggerUrl,
                        swaggerJsonUrl: args.swaggerJsonUrl,
                    }
                );
            }
        );

        context.subscriptions.push(cmdOhSwagger);
    };
}
