import { ConnectionSchema } from "./ConnectionSchema";
import { RegisteredHiveWorker } from "./RegisteredHiveWorker";
import { ServerSettings } from "./ServerSettings";

export class CoreGlobalObject {
    public ohDirName: string = "";
    public registeredSchemas: ConnectionSchema[] = [];
    public registeredWorkers: RegisteredHiveWorker[] = [];
    public serverSettings: ServerSettings = new ServerSettings();
}
