import { IHiveWorker } from "./IHiveWorker.js";

export interface IStorageWorker extends IHiveWorker {
    exists: (key: string) => Promise<boolean>;
    get: <T extends unknown>(key: string) => Promise<T | undefined>;
    remove: (key: string) => Promise<boolean>;
    set: <T extends unknown>(key: string, model: T) => Promise<boolean>;
}
