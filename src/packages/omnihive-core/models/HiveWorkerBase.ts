import { ObjectHelper } from "../helpers/ObjectHelper";
import { StringHelper } from "../helpers/StringHelper";
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

            if (
                objectAny[key] &&
                typeof objectAny[key] === "string" &&
                StringHelper.isNullOrWhiteSpace(objectAny[key])
            ) {
                throw new Error(`Object key ${key} is a string but it is blank on hive worker ${this.config.name}`);
            }

            if (objectAny[key] && Array.isArray(objectAny[key])) {
                if ((objectAny[key] as Array<any>).length === 0) {
                    throw new Error(`Object key ${key} is an array but it is empty on hive worker ${this.config.name}`);
                }
            }
        });

        return objectData;
    };
}
