import { HiveWorker } from "./HiveWorker";
import { ServerConfigSettings } from "./ServerConfigSettings";

export class ServerSettings {
    public config: ServerConfigSettings = new ServerConfigSettings();
    public constants: { [key: string]: string } = {};
    public features: { [key: string]: unknown } = {};
    public workers: HiveWorker[] = [];
}
