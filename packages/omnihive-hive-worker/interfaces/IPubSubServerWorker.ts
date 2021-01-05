import { IHiveWorker } from "./IHiveWorker";

export interface IPubSubServerWorker extends IHiveWorker {
    emit: (channelName: string, eventName: string, message: any) => Promise<void>;
}