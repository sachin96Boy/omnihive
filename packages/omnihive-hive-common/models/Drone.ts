import { DroneType } from "../enums/DroneType";

export class Drone {
    public name: string = "";
    public type: DroneType = DroneType.None;
    public package: string = "";
    public version: string = "";
    public classPath: string = "";
    public enabled: boolean = false;
}