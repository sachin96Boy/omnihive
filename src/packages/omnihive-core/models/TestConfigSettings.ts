import { HiveWorker } from "./HiveWorker";

export class TestConfigSettings {
    public package: string = "";
    public enabled: boolean = true;
    public workers: HiveWorker[] = [];
}
