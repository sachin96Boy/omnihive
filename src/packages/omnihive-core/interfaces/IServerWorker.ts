import { IHiveWorker } from "./IHiveWorker";

export interface IServerWorker extends IHiveWorker {
    buildServer: () => Promise<void>;
}
