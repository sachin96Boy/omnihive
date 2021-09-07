import { VsCodeWebpanelRoute } from "../enums/VsCodeWebpanelRoute";
import { ExtensionConfiguration } from "./ExtensionConfiguration";
import { RegisteredServerModel } from "./RegisteredServerModel";
import { WebpanelImageSources } from "./WebpanelImageSources";

export type ReactPropsModel = {
    panelData: any;
    vscode: any;
    extensionConfiguration: ExtensionConfiguration;
    registeredServers: RegisteredServerModel[];
    webpanelRoute: VsCodeWebpanelRoute;
    imageSources: WebpanelImageSources;
};
