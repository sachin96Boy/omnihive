import { OmniHiveLogLevel } from "../enums/OmniHiveLogLevel";
import { IHiveWorker } from "./IHiveWorker";

export interface ILogWorker extends IHiveWorker {
    write: (logLevel: OmniHiveLogLevel, logString: string) => Promise<void>;
}