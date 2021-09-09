import { IHiveWorker } from "./IHiveWorker.js";

export interface IFeatureWorker extends IHiveWorker {
    get: <T extends unknown>(name: string, defaultValue?: unknown) => Promise<T | undefined>;
}
