import { HiveWorker } from "./HiveWorker";
import { ClientSettings } from "./ClientSettings";
import { ServerSettings } from "@withonevision/omnihive-hive-common/models/ServerSettings";
import { LifecycleDrone } from "./LifecycleDrone";
import { Drone } from "./Drone";

export class SystemSettings {
    public server: ServerSettings = new ServerSettings();
    public client: ClientSettings = new ClientSettings();
    public workers: HiveWorker[] = [];
    public drones: Drone[] | LifecycleDrone[] = [];
}
