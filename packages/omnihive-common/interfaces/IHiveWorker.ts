import { HiveWorker } from "../models/HiveWorker";

export interface IHiveWorker {
    afterInit: () => Promise<void>;
    config: HiveWorker;
    init: (hiveWorker: HiveWorker) => Promise<void>;
}