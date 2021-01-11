import { ObjectHelper } from "../helpers/ObjectHelper";
import { StringHelper } from "../helpers/StringHelper";
import { IHiveWorker } from '../interfaces/IHiveWorker';
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

    public checkMetadata = <T extends object>(type: { new (): T }, model: any | null): T => {

        const metadata: T = ObjectHelper.createStrict<T>(type, model);
        const metaAny: any = metadata as any;

        Object.keys(metadata).forEach((key: string) => {
            if(!metaAny[key]) {
                throw new Error(`Metadata key ${key} is null or undefined on hive worker ${this.config.name}`);
            }

            if (metaAny[key] && typeof metaAny[key] === "string" && StringHelper.isNullOrWhiteSpace(metaAny[key])) {
                throw new Error(`Metadata key ${key} is a string but it is blank on hive worker ${this.config.name}`);
            }

            if (metaAny[key] && Array.isArray(metaAny[key])) {
                if ((metaAny[key] as Array<any>).length === 0) {
                    throw new Error(`Metadata key ${key} is an array but it is empty on hive worker ${this.config.name}`);
                }
            }
        });

        return metadata;
    }
}