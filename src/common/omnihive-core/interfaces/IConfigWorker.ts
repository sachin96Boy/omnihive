import { ServerConfig } from "../models/ServerConfig.js";
import { IHiveWorker } from "./IHiveWorker";

export interface IConfigWorker extends IHiveWorker {
    get: () => Promise<ServerConfig>;
    set: (serverConfig: ServerConfig) => Promise<boolean>;
}
