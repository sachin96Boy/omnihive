import { DropDirection } from "rc-dock";
import React from "react";

export type UseOpenGridTabProps = {
    title: string;
    location: DropDirection;
    tabChildren: React.ReactElement;
};

export const useOpenGridTab = () => {
    return (moduleKey: string, title: string, location: DropDirection, tabChildren: React.ReactElement) => {
        const customEvent = new CustomEvent<UseOpenGridTabProps>(`omnihive-grid-openTab-${moduleKey}`, {
            detail: { title, tabChildren, location },
        });
        window.dispatchEvent(customEvent);
    };
};
