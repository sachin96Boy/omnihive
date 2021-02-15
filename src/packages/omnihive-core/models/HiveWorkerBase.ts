import { HiveWorkerType } from "../enums/HiveWorkerType";
import { ObjectHelper } from "../helpers/ObjectHelper";
import { IHiveWorker } from "../interfaces/IHiveWorker";
import { ILogWorker } from "../interfaces/ILogWorker";
import { HiveWorker } from "./HiveWorker";
import { RegisteredHiveWorker } from "./RegisteredHiveWorker";
import { ServerSettings } from "./ServerSettings";

export abstract class HiveWorkerBase implements IHiveWorker {
    public config!: HiveWorker;
    public registeredWorkers!: RegisteredHiveWorker[];
    public serverSettings!: ServerSettings;
    public logWorker!: ILogWorker | undefined;

    public async afterInit(registeredWorkers: RegisteredHiveWorker[], serverSettings: ServerSettings): Promise<void> {
        this.registeredWorkers = registeredWorkers;
        this.serverSettings = serverSettings;

        this.logWorker = <ILogWorker | undefined>this.getWorker<ILogWorker | undefined>(HiveWorkerType.Log);

        if (!this.logWorker) {
            throw new Error("Log Worker Not Defined.  Feature worker Will Not Function Without Log Worker.");
        }

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

    public getWorker = <T extends IHiveWorker | undefined>(type: string, name?: string): T | undefined => {
        if (this.registeredWorkers.length === 0) {
            return undefined;
        }

        if (name) {
            const namedWorker = this.registeredWorkers.find(
                (value: RegisteredHiveWorker) => value.name === name && value.type === type
            );

            if (namedWorker) {
                return namedWorker.instance as T;
            }

            return undefined;
        }

        const typeWorker = this.registeredWorkers.find(
            (value: RegisteredHiveWorker) => value.type === type && value.default === true
        );

        if (typeWorker) {
            return typeWorker.instance as T;
        }

        return undefined;
    };
}
