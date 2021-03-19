import { HiveWorker } from "./HiveWorker";

export class RegisteredHiveWorker extends HiveWorker {
    public instance: any;
    public isBoot: boolean = false;
    public isCore: boolean = false;
}
