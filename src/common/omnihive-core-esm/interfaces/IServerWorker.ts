import { IHiveWorker } from "./IHiveWorker.js";

export interface IServerWorker extends IHiveWorker {
    buildServer: (app: any) => Promise<any>;
}
