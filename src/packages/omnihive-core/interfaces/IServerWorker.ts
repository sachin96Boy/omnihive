import { IHiveWorker } from "./IHiveWorker";

export interface IServerWorker extends IHiveWorker {
    buildServer: (app: any) => Promise<any>;
}
