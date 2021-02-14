import { ConnectionSchema } from "./ConnectionSchema";
import { HiveAccount } from "./HiveAccount";
import { RegisteredHiveWorker } from "./RegisteredHiveWorker";
import { ServerSettings } from "./ServerSettings";

export class CoreGlobalObject {
    public account: HiveAccount = new HiveAccount();
    public ohDirName: string = "";
    public registeredSchemas: ConnectionSchema[] = [];
    public registeredWorkers: RegisteredHiveWorker[] = [];
    public serverSettings: ServerSettings = new ServerSettings();
}
