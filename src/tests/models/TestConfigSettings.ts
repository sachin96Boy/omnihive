import { HiveWorker } from "../../packages/omnihive-core/models/HiveWorker";

export class TestConfigSettings {
    public package: string = "";
    public enabled: boolean = true;
    public constants: any = {};
    public workers: HiveWorker[] = [];
}
