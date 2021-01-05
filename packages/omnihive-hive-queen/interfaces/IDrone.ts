import { Drone } from "@withonevision/omnihive-hive-common/models/Drone";

export interface IDrone {
    config: Drone;
    init: (config: Drone) => Promise<void>;
}