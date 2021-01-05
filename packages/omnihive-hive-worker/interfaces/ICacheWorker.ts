import { IHiveWorker } from "./IHiveWorker";

export interface ICacheWorker extends IHiveWorker {
    exists: (key: string) => Promise<boolean>;
    get: (key: string) => Promise<string | undefined>;
    set: (key: string, value: string, expireSeconds: number) => Promise<boolean>;
    remove: (key: string) => Promise<boolean>;
}