import { OmniHiveLogLevel } from "../enums/OmniHiveLogLevel.js";
import { IHiveWorker } from "./IHiveWorker.js";

export interface ILogWorker extends IHiveWorker {
    write: (logLevel: OmniHiveLogLevel, logString: string) => Promise<void>;
}
