import DockLayout, { DropDirection, LayoutData, PanelData, TabData } from "rc-dock";
import React, { useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import emptyDockBee from "../assets/empty_dock_bee.png";
import { useCustomEventListener } from "../hooks/useCustomEventListener";
import { UseOpenGridTabProps } from "../hooks/useOpenGridTab";

export type ModuleDockProps = {
    moduleKey: string;
};

export const ModuleDock: React.FC<ModuleDockProps> = (props: ModuleDockProps): React.ReactElement => {
    const defaultGroups = {
        default: { animated: false },
    };

    const defaultLayout: LayoutData = {
        dockbox: {
            mode: "vertical",
            children: [
                {
                    id: props.moduleKey,
                    tabs: [],
                },
            ],
        },
    };

    const dockRef = useRef<DockLayout>(null);
    const [tabCount, setTabCount] = useState<number>(0);
    const [dockLayout, setDockLayout] = useState<LayoutData>(defaultLayout);

    useCustomEventListener(`omnihive-grid-openTab-${props.moduleKey}`, (eventProps: UseOpenGridTabProps) => {
        const counter = tabCount;

        const tabData: TabData = {
            id: uuidv4(),
            title: <span title={`${eventProps.title}`}>{eventProps.title}</span>,
            closable: true,
            group: "default",
            content: eventProps.tabChildren,
        };

        if (counter + 1 > 1) {
            dockRef.current?.dockMove(tabData, `${props.moduleKey}`, eventProps.location);
        }

        if (counter + 1 === 1) {
            const layout: LayoutData = dockLayout;
            (layout.dockbox.children[0] as PanelData).tabs = [];
            (layout.dockbox.children[0] as PanelData).tabs.push(tabData);
            setDockLayout(layout);
        }

        setTabCount(counter + 1);
    });

    const onLayoutChange = (_newLayout: LayoutData, _currentTabId?: string, direction?: DropDirection) => {
        if (direction === "remove") {
            const counter = tabCount;
            if (counter - 1 <= 0) {
                setTabCount(0);
            } else {
                setTabCount(counter - 1);
            }
        }
    };

    return (
        <>
            {tabCount === 0 && (
                <div style={{ width: "75%" }}>
                    <div className="flex items-center justify-center h-full w-full bg-omnihiveSidebar">
                        <img style={{ height: 200, opacity: 0.1 }} src={emptyDockBee} alt="bee" />
                    </div>
                </div>
            )}
            {tabCount > 0 && (
                <DockLayout
                    style={{ width: "75%" }}
                    ref={dockRef}
                    groups={defaultGroups}
                    defaultLayout={dockLayout}
                    onLayoutChange={onLayoutChange}
                />
            )}
        </>
    );
};
