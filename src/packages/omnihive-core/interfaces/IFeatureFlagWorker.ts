import { IHiveWorker } from "./IHiveWorker";

export interface IFeatureFlagWorker extends IHiveWorker {
    get: <T extends unknown>(name: string, defaultValue?: boolean) => Promise<T | undefined>;
}
