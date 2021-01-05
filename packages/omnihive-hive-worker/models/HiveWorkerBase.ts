import { HiveWorker } from '@withonevision/omnihive-hive-common/models/HiveWorker';
import { HiveWorkerHelper } from '../helpers/HiveWorkerHelper';
import { IHiveWorker } from '../interfaces/IHiveWorker';

export abstract class HiveWorkerBase implements IHiveWorker {

    public config!: HiveWorker;
    protected hiveWorkerHelper!: HiveWorkerHelper; 

    public async afterInit(): Promise<void> {
        return;
    }
    
    public async init(config: HiveWorker): Promise<void> {

        if (!config || Object.keys(config).length <= 0) {
            throw new Error("Configuration not specified");
        }

        this.config = config;
        this.hiveWorkerHelper = new HiveWorkerHelper(config);
    }
}