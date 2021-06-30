import { IHiveWorker } from "./IHiveWorker";

export interface IDataLifecycleWorker extends IHiveWorker {
    execute: (obj: any, args: any, context: any, info: any) => Promise<{}>;
}
