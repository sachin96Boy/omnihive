import { HiveWorker } from "@withonevision/omnihive-hive-common/models/HiveWorker";

export interface IHiveWorker {
    afterInit: () => Promise<void>;
    config: HiveWorker;
    init: (hiveWorker: HiveWorker) => Promise<void>;
}