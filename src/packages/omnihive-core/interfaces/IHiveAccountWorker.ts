import { HiveAccount } from "../models/HiveAccount";
import { IHiveWorker } from "./IHiveWorker";

export interface IHiveAccountWorker extends IHiveWorker {
    getHiveAccount: () => Promise<HiveAccount>;
}
