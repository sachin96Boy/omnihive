import { HiveWorker } from "../models/HiveWorker";
import { RegisteredHiveWorker } from "../models/RegisteredHiveWorker";
import { ServerSettings } from "../models/ServerSettings";

export interface IHiveWorker {
    afterInit: (registeredWorkers: RegisteredHiveWorker[], serverSettings: ServerSettings) => Promise<void>;
    checkObjectStructure: <T extends object>(type: { new (): T }, model: any | null) => T;
    config: HiveWorker;
    getWorker: <T extends IHiveWorker | undefined>(type: string, name?: string) => T | undefined;
    init: (hiveWorker: HiveWorker) => Promise<void>;
}
