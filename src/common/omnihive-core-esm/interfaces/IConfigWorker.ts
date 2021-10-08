import { ServerConfig } from "../models/ServerConfig.js";
import { IHiveWorker } from "./IHiveWorker.js";

export interface IConfigWorker extends IHiveWorker {
    get: () => Promise<ServerConfig>;
    set: (serverConfig: ServerConfig) => Promise<boolean>;
}
