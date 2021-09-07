import { DividerBox } from "rc-dock";
import React from "react";
import { ModuleDock } from "@withonevision/omnihive-desktop-core/components/ModuleDock";
import { useOpenGridTab } from "@withonevision/omnihive-desktop-core/hooks/useOpenGridTab";
import { AddEditServer } from "./components/AddEditServer";
import addIcon from "./assets/add.png";
import trashIcon from "./assets/trash.png";

const moduleKey: string = "withonevision-omnihive-desktop-server-manager";
const serverTreeHeaderButtonStyle: string = "h-6 w-6 ml-1 mr-1 hover:cursor-pointer";

const Index: React.FC = (): React.ReactElement => {
    const gridOpen = useOpenGridTab();

    return (
        <div className="w-full h-full">
            <DividerBox className="absolute top-0 left-0 right-0 bottom-0">
                <div className="mt-1 ml-3 w-omnihiveServerManagerTree min-w-omnihiveServerManagerTree max-w-omnihiveServerManagerTree bg-omnihiveBackgroundColor">
                    <div className="flex text-white text-xs mt-1">
                        <div className="self-start w-1/2 mt-1">OMNIHIVE SERVERS</div>
                        <div className="w-1/2 flex pr-2 justify-end">
                            <div
                                className={serverTreeHeaderButtonStyle}
                                title="Add Server"
                                onClick={() => {
                                    gridOpen(moduleKey, "Add Server", "middle", <AddEditServer mode="add" />);
                                }}
                            >
                                <img src={addIcon} />
                            </div>
                            <div className={serverTreeHeaderButtonStyle} title="Remove All Servers">
                                <img src={trashIcon} />
                            </div>
                        </div>
                    </div>
                </div>
                <ModuleDock moduleKey={moduleKey} />
            </DividerBox>
        </div>
    );
};

export default Index;
