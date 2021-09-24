import { useCallback } from "react";

export const useCustomEventDispatcher = (eventName: string, data: any = {}) => {
    return useCallback(() => {
        const customEvent = new CustomEvent(eventName, { detail: data });
        window.dispatchEvent(customEvent);
    }, [eventName, data]);
};
