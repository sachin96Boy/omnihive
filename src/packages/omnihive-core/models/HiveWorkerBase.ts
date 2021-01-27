import { ObjectHelper } from "../helpers/ObjectHelper";
import { IHiveWorker } from "../interfaces/IHiveWorker";
import { HiveWorker } from "./HiveWorker";

export abstract class HiveWorkerBase implements IHiveWorker {
    public config!: HiveWorker;

    public async afterInit(): Promise<void> {
        return;
    }

    public async init(config: HiveWorker): Promise<void> {
        if (!config || Object.keys(config).length <= 0) {
            throw new Error("Configuration not specified");
        }

        this.config = config;
    }

    public checkObjectStructure = <T extends object>(type: { new (): T }, model: any | null): T => {
        const objectData: T = ObjectHelper.createStrict<T>(type, model);
        const objectAny: any = objectData as any;

        Object.keys(objectData).forEach((key: string) => {
            if (!objectAny[key]) {
                throw new Error(`Object key ${key} is null or undefined on hive worker ${this.config.name}`);
            }
        });

        return objectData;
    };
}
