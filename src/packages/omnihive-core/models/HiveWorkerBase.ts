import { ObjectHelper } from "../helpers/ObjectHelper";
import { IHiveWorker } from "../interfaces/IHiveWorker";
import { HiveWorker } from "./HiveWorker";
import { RegisteredHiveWorker } from "./RegisteredHiveWorker";
import { ServerSettings } from "./ServerSettings";

export abstract class HiveWorkerBase implements IHiveWorker {
    public config!: HiveWorker;
    public registeredWorkers!: RegisteredHiveWorker[];
    public serverSettings!: ServerSettings;

    public async afterInit(registeredWorkers: RegisteredHiveWorker[], serverSettings: ServerSettings): Promise<void> {
        this.registeredWorkers = registeredWorkers;
        this.serverSettings = serverSettings;
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

    public getWorker<T extends IHiveWorker | undefined>(type: string, name?: string): T | undefined {
        if (name) {
            const namedWorker: RegisteredHiveWorker | undefined = this.registeredWorkers.find(
                (value: RegisteredHiveWorker) => value.name === name && value.type === type && value.enabled === true
            );

            if (namedWorker) {
                return namedWorker.instance as T;
            }

            return undefined;
        }

        const defaultWorker: RegisteredHiveWorker | undefined = this.registeredWorkers.find(
            (value: RegisteredHiveWorker) => value.type === type && value.enabled === true && value.default === true
        );

        if (defaultWorker) {
            return defaultWorker.instance as T;
        }

        const anyWorkers: RegisteredHiveWorker[] | undefined = this.registeredWorkers.filter(
            (value: RegisteredHiveWorker) => value.type === type && value.enabled === true
        );

        if (anyWorkers && anyWorkers.length > 0) {
            return anyWorkers[0].instance as T;
        }

        return undefined;
    }
}
