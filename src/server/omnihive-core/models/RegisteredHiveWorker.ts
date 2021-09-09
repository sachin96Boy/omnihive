import { HiveWorkerType } from "../enums/HiveWorkerType.js";
import { RegisteredHiveWorkerSection } from "../enums/RegisteredHiveWorkerSection.js";

export class RegisteredHiveWorker {
    public instance: any;
    public name: string = "";
    public type: HiveWorkerType | string = HiveWorkerType.User;
    public metadata: any;
    public section: RegisteredHiveWorkerSection = RegisteredHiveWorkerSection.User;
}
