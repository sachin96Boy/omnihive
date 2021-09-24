import { IHiveWorker } from "./IHiveWorker";

export interface ITaskEndpointWorker extends IHiveWorker {
    execute: (customArgs?: any) => Promise<void>;
}
