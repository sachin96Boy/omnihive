import { IHiveWorker } from './IHiveWorker';

export interface ITokenWorker extends IHiveWorker {
    get: (payload?: object) => Promise<string>;
    expired: (token: string) => Promise<boolean>;
    verify: (token: string) => Promise<boolean>;
}