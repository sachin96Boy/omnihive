import { IHiveWorker } from "./IHiveWorker.js";

export interface IErrorWorker extends IHiveWorker {
    handleException: (error: string) => Promise<void>;
}
