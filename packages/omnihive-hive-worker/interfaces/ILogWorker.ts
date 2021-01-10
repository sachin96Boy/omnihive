import { OmniHiveLogLevel } from "@withonevision/omnihive-hive-common/enums/OmniHiveLogLevel";
import { IHiveWorker } from "./IHiveWorker";

export interface ILogWorker extends IHiveWorker {
    write: (logLevel: OmniHiveLogLevel, logString: string) => Promise<void>;
}