import { IHiveWorker } from "./IHiveWorker";

export interface IErrorWorker extends IHiveWorker {
    handleException: (error: string) => Promise<void>;
}