import React, { useState, useEffect, useCallback } from "react";
import ReactTooltip from "react-tooltip";
import ServerManager from "@withonevision/omnihive-desktop-server-manager/index";
import { DesktopModule } from "@withonevision/omnihive-desktop-core/models/DesktopModule";
import _ from "lodash";
import { IsHelper } from "@withonevision/omnihive-core/helpers/IsHelper";
import { AppSettings } from "@withonevision/omnihive-desktop-core/models/AppSettings";
import blankAppImage from "../../resources/blank_app.png";
import serverManagerIcon from "@withonevision/omnihive-desktop-server-manager/assets/sidebar_icon.png";
import { ipcRenderer } from "electron-better-ipc";

const registeredModules: DesktopModule[] = [
    {
        key: "withonevision-omnihive-desktop-server-manager",
        displayName: "Server Manager",
        imageSource: serverManagerIcon,
    },
];

const App: React.FC = (): React.ReactElement => {
    const [activeModuleKey, setActiveModuleKey] = useState<string>("withonevision-omnihive-desktop-server-manager");
    const [appSettings, setAppSettings] = useState<AppSettings>(new AppSettings());

    const getAppSettings = useCallback(async () => {
        const appSettings: AppSettings = (await ipcRenderer.callMain<AppSettings>(
            "renderer-request-appSettings"
        )) as AppSettings;

        console.log("Renderer Process Received AppSettings From Main", appSettings);

        if (!IsHelper.isNullOrUndefined(appSettings)) {
            setAppSettings(appSettings);
        }
    }, [setAppSettings]);

    const renderBlankPlaceholders = (): React.ReactElement[] => {
        const blankPlaceholders: React.ReactElement[] = [];

        for (let i = 1; i < 10; i++) {
            blankPlaceholders.push(
                <div
                    key={i}
                    className="mb-1 mt-2 w-10 h-10 rounded-md flex justify-center items-center bg-omnihiveBackgroundColor"
                >
                    <img className="w-8 h-8 rounded-md" src={blankAppImage} alt="Blank App" />
                </div>
            );
        }

        return blankPlaceholders;
    };

    useEffect(() => {
        getAppSettings();
    }, [getAppSettings]);

    useEffect(() => {
        if (IsHelper.isNullOrUndefined(appSettings)) {
            return;
        }

        console.log("Renderer Process Changed AppSettings", appSettings);
        ipcRenderer.callMain("renderer-changed-appSettings", appSettings);
    }, [appSettings, setAppSettings]);

    return (
        <div className="absolute bottom-0 top-0 left-0 w-full h-full flex bg-omnihiveBackgroundColor">
            <div className="w-16 pt-2 pl-2 flex flex-col text-center bg-omnihiveSidebar min-w-omnihiveSidebar max-w-omnihiveSidebar">
                <div className="flex-auto">
                    {registeredModules.map((desktopModule: DesktopModule) => (
                        <React.Fragment key={desktopModule.key}>
                            <div
                                className={`mb-1 mt-2 w-10 h-10 rounded-md flex justify-center items-center bg-omnihiveBackgroundColor hover:cursor-pointer ${
                                    activeModuleKey === desktopModule.key ? `border border-solid border-white` : ``
                                }`}
                                data-tip
                                data-for={`${desktopModule.key}-tooltip`}
                                onClick={() => {
                                    if (desktopModule.key !== activeModuleKey) {
                                        setActiveModuleKey(desktopModule.key);
                                    }
                                }}
                            >
                                <img
                                    className="w-8 h-8 rounded-md"
                                    src={desktopModule.imageSource}
                                    alt={desktopModule.displayName}
                                />
                            </div>
                            <ReactTooltip id={`${desktopModule.key}-tooltip`} place="top" effect="solid" type="warning">
                                {desktopModule.displayName}
                            </ReactTooltip>
                        </React.Fragment>
                    ))}
                    {renderBlankPlaceholders()}
                </div>
            </div>
            <div className="absolute left-14 top-0 right-0 bottom-0 bg-omnihiveBackgroundColor">
                {activeModuleKey === "withonevision-omnihive-desktop-server-manager" && <ServerManager />}
            </div>
        </div>
    );
};

export default App;
