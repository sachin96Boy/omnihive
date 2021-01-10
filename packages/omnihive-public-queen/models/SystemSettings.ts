import { HiveWorker } from "./HiveWorker";
import { ClientSettings } from "./ClientSettings";
import { ServerSettings } from "../models/ServerSettings";

export class SystemSettings {
    public server: ServerSettings = new ServerSettings();
    public client: ClientSettings = new ClientSettings();
    public workers: HiveWorker[] = [];
}
