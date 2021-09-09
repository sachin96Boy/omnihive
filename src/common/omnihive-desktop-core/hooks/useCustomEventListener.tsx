import { useRef, useEffect } from "react";

export type UseEventListenerOptions = {
    capture?: boolean;
    passive?: boolean;
    once?: boolean;
};

export const useCustomEventListener = (
    eventName: string,
    handler: (handlerData: any) => void,
    options: UseEventListenerOptions = {}
) => {
    const savedHandler = useRef<any>(null);
    const { capture, passive, once } = options;

    useEffect(() => {
        savedHandler.current = handler;
    }, [handler]);

    useEffect(() => {
        const isSupported = window && window.addEventListener;
        if (!isSupported) {
            return;
        }

        const eventListener = (event: CustomEvent) => savedHandler.current(event.detail);
        const opts = { capture, passive, once };
        window.addEventListener(eventName, eventListener as (e: Event) => void, opts);
        return () => {
            window.removeEventListener(eventName, eventListener as (e: Event) => void, opts);
        };
    }, [eventName, capture, passive, once]);
};
