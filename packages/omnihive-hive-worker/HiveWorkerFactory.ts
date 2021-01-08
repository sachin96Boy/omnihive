import { AwaitHelper } from '@withonevision/omnihive-hive-common/helpers/AwaitHelper';
import { HiveWorker } from '@withonevision/omnihive-hive-common/models/HiveWorker';
import { serializeError } from 'serialize-error';
import { IHiveWorker } from './interfaces/IHiveWorker';

export class HiveWorkerFactory {

    private static instance: HiveWorkerFactory;

    public workers: [HiveWorker, any][] = [];
    public isInit: boolean = false;

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    private constructor() { }

    public static getInstance = (): HiveWorkerFactory => {
        if (!HiveWorkerFactory.instance) {
            HiveWorkerFactory.instance = new HiveWorkerFactory();
        }

        return HiveWorkerFactory.instance;
    }

    public static getNew = (): HiveWorkerFactory => {
        return new HiveWorkerFactory();
    }

    public init = async (configs: HiveWorker[]): Promise<void> => {
        try {
            for (const hiveWorker of configs) {
                if (!hiveWorker.enabled) {
                    continue;
                }

                if (!hiveWorker.classPath || hiveWorker.classPath === "") {
                    throw new Error(`Hive worker type ${hiveWorker.type} with name ${hiveWorker.name} has no classPath`);
                }

                const newWorker: any = await AwaitHelper.execute<any>(import(hiveWorker.classPath));
                const newWorkerInstance: any = new newWorker.default();
                await AwaitHelper.execute<void>((newWorkerInstance as IHiveWorker).init(hiveWorker));

                this.workers.push([hiveWorker, newWorkerInstance]);
            }

            this.isInit = true;

            for (const worker of this.workers) {
                await AwaitHelper.execute<void>((worker[1] as IHiveWorker).afterInit());
            }
        } catch (err) {
            throw new Error("Worker Factory Init Error => " + JSON.stringify(serializeError(err)));
        }
    }

    public clearWorkers = (): void => {
        this.workers = [];
    }

    public getHiveWorker = async <T extends IHiveWorker | undefined>(type: string, name?: string): Promise<T | undefined> => {

        if (!this.isInit || this.workers.length === 0) {
            throw new Error("Hive Worker Factory Has Not Been Initialized");
        }

        let hiveWorker: [HiveWorker, any] | undefined = undefined;

        if (!name) {
            hiveWorker = this.workers.find((d: [HiveWorker, any]) => d[0].type === type && d[0].default === true && d[0].enabled === true);

            if (!hiveWorker) {
                return undefined;
            }

        } else {
            hiveWorker = this.workers.find((d: [HiveWorker, any]) => d[0].type === type && d[0].name === name && d[0].enabled === true);

            if (!hiveWorker) {
                return undefined;
            }
        }

        return hiveWorker[1] as T;
    }

    public registerWorker = async (hiveWorker: HiveWorker): Promise<[HiveWorker, any]> => {

        if (!hiveWorker.classPath || hiveWorker.classPath === "") {
            throw new Error(`Hive worker type ${hiveWorker.type} with name ${hiveWorker.name} has no classPath`);
        }

        const newWorker: any = await AwaitHelper.execute<any>(import(hiveWorker.classPath));
        const newWorkerInstance: any = new newWorker.default();
        await AwaitHelper.execute<void>((newWorkerInstance as IHiveWorker).init(hiveWorker));
        await AwaitHelper.execute<void>((newWorkerInstance as IHiveWorker).afterInit());

        this.workers.push([hiveWorker, newWorkerInstance]);

        return [hiveWorker, newWorkerInstance];
    }
}