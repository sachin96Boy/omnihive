import { LifecycleDroneAction } from "../enums/LifecycleDroneAction";
import { LifecycleDroneStage } from "../enums/LifecycleDroneStage";
import { Drone } from "./Drone";

export class LifecycleDrone extends Drone {
    public lifecycleAction: LifecycleDroneAction = LifecycleDroneAction.None;
    public lifecycleStage: LifecycleDroneStage = LifecycleDroneStage.None;
    public lifecycleOrder: number = 0;
    public lifecycleWorker: string = "";
    public lifecycleTables: string[] = [];
}