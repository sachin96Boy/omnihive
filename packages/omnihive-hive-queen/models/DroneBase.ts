import { IDrone } from "../interfaces/IDrone";
import { Drone } from "@withonevision/omnihive-hive-common/models/Drone";

export abstract class DroneBase implements IDrone {
    
    public config!: Drone;

    public async init(config: Drone): Promise<void> {
        this.config = config;
    }
}