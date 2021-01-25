import { IHiveWorker } from "./IHiveWorker";

export interface IGraphEndpointWorker extends IHiveWorker {
    execute: (customArgs: any) => Promise<{}>;
}
