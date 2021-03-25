import { IHiveWorker } from "./IHiveWorker";

export interface ITokenWorker extends IHiveWorker {
    get: () => Promise<string>;
    expired: (token: string) => Promise<boolean>;
    verify: (token: string) => Promise<boolean>;
}
