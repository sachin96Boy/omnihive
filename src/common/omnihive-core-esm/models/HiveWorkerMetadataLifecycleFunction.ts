import { LifecycleWorkerAction } from "../enums/LifecycleWorkerAction.js";
import { LifecycleWorkerStage } from "../enums/LifecycleWorkerStage.js";

export class HiveWorkerMetadataLifecycleFunction {
    public action: LifecycleWorkerAction = LifecycleWorkerAction.None;
    public stage: LifecycleWorkerStage = LifecycleWorkerStage.None;
    public order: number = 0;
    public databaseWorker: string = "";
    public schema: string = "";
    public tables: string[] = [];
}
