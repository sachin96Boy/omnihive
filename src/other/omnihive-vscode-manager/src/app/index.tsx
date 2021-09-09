import React from "react";
import ReactDOM from "react-dom";
import { VsCodeWebpanelRoute } from "../enums/VsCodeWebpanelRoute";
import { ReactPropsModel } from "../models/ReactPropsModel";
import { WebpanelImageSources } from "../models/WebpanelImageSources";
import { AddEditServer } from "./pages/AddEditServer";
import { GraphBrowser } from "./pages/GraphBrowser";
import { LogViewer } from "./pages/LogViewer";
import { RawEditor } from "./pages/RawEditor";
import { RetrieveToken } from "./pages/RetrieveToken";
import { SettingsEditor } from "./pages/SettingsEditor";

import "./styles/styles.css";
declare global {
    interface Window {
        acquireVsCodeApi(): any;
        panelData: string;
        extensionConfiguration: string;
        registeredServers: string;
        webpanelRoute: VsCodeWebpanelRoute;
        imageSources: WebpanelImageSources;
    }
}

const props: ReactPropsModel = {
    panelData: JSON.parse(window.panelData),
    vscode: window.acquireVsCodeApi(),
    extensionConfiguration: JSON.parse(window.extensionConfiguration),
    registeredServers: JSON.parse(window.registeredServers),
    webpanelRoute: window.webpanelRoute,
    imageSources: window.imageSources,
};

ReactDOM.render(
    <div
        className="h-full w-full overflow-hidden"
        style={{ backgroundColor: props.extensionConfiguration.stylesWebPanelBackgroundColorHex }}
    >
        {props.webpanelRoute === VsCodeWebpanelRoute.AddServer && <AddEditServer props={props} />}
        {props.webpanelRoute === VsCodeWebpanelRoute.EditServer && <AddEditServer props={props} />}
        {props.webpanelRoute === VsCodeWebpanelRoute.GraphBrowser && <GraphBrowser props={props} />}
        {props.webpanelRoute === VsCodeWebpanelRoute.LogViewer && <LogViewer props={props} />}
        {props.webpanelRoute === VsCodeWebpanelRoute.EditServerEnvironment && (
            <SettingsEditor panelProps={props} settingsSection="environmentVariables" />
        )}
        {props.webpanelRoute === VsCodeWebpanelRoute.EditServerWorkers && (
            <SettingsEditor panelProps={props} settingsSection="workers" />
        )}
        {props.webpanelRoute === VsCodeWebpanelRoute.RawEditor && <RawEditor props={props} />}
        {props.webpanelRoute === VsCodeWebpanelRoute.RetrieveToken && <RetrieveToken props={props} />}
    </div>,
    document.getElementById("root")
);
