import { AuthUser } from "../models/AuthUser";
import { IHiveWorker } from "./IHiveWorker";

export interface IUserWorker extends IHiveWorker {
    create: (email: string, password: string) => Promise<AuthUser>;
    get: (email: string) => Promise<AuthUser>;
    login: (email: string, password: string) => Promise<AuthUser>;
    passwordChangeRequest: (email: string) => Promise<boolean>;
    update: (userName: string, authUser: AuthUser) => Promise<AuthUser>;
    getUserIdByEmail: (email: string) => Promise<string | undefined>;
    delete: (id: string) => Promise<string>;
}
