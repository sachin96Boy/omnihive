import { IHiveWorker } from "./IHiveWorker.js";

export interface ITaskEndpointWorker extends IHiveWorker {
    execute: (customArgs?: any) => Promise<void>;
}
