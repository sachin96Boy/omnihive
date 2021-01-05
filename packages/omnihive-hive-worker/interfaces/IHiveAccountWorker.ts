import { HiveAccount } from "@withonevision/omnihive-hive-common/models/HiveAccount";
import { IHiveWorker } from "./IHiveWorker";

export interface IHiveAccountWorker extends IHiveWorker {
    getHiveAccount: () => Promise<HiveAccount>;
}
