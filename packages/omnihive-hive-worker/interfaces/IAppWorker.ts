import { NormalizedReadResult } from "read-pkg-up";
import { IHiveWorker } from "./IHiveWorker";

export interface IAppWorker extends IHiveWorker {
    initApp: (settingsPath: string | undefined, packageJson: NormalizedReadResult | undefined) => Promise<void>;
}