import path from "path";
import { serializeError } from "serialize-error";
import { AwaitHelper } from "../helpers/AwaitHelper";
import { IHiveWorker } from "../interfaces/IHiveWorker";
import { HiveWorker } from "../models/HiveWorker";

export class WorkerService {
    private static singleton: WorkerService;

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    private constructor() {}

    public static getSingleton = (): WorkerService => {
        if (!WorkerService.singleton) {
            WorkerService.singleton = new WorkerService();
        }

        return WorkerService.singleton;
    };

    public registeredWorkers: [HiveWorker, any][] = [];

    public initWorkers = async (configs: HiveWorker[]): Promise<void> => {
        try {
            for (const hiveWorker of configs) {
                if (!hiveWorker.enabled) {
                    continue;
                }

                if (!hiveWorker.importPath || hiveWorker.importPath === "") {
                    throw new Error(
                        `Hive worker type ${hiveWorker.type} with name ${hiveWorker.name} has no import path`
                    );
                }

                if (hiveWorker.package === "") {
                    hiveWorker.importPath = path.join(process.cwd(), hiveWorker.importPath);
                }

                const newWorker: any = await AwaitHelper.execute<any>(import(hiveWorker.importPath));
                const newWorkerInstance: any = new newWorker.default();
                await AwaitHelper.execute<void>((newWorkerInstance as IHiveWorker).init(hiveWorker));

                this.registeredWorkers.push([hiveWorker, newWorkerInstance]);
            }

            for (const worker of this.registeredWorkers) {
                await AwaitHelper.execute<void>((worker[1] as IHiveWorker).afterInit());
            }
        } catch (err) {
            throw new Error("Worker Factory Init Error => " + JSON.stringify(serializeError(err)));
        }
    };

    public clearWorkers = (): void => {
        this.registeredWorkers = [];
    };

    public getWorker = async <T extends IHiveWorker | undefined>(
        type: string,
        name?: string
    ): Promise<T | undefined> => {
        if (this.registeredWorkers.length === 0) {
            return undefined;
        }

        let hiveWorker: [HiveWorker, any] | undefined = undefined;

        if (!name) {
            hiveWorker = this.registeredWorkers.find(
                (d: [HiveWorker, any]) => d[0].type === type && d[0].default === true && d[0].enabled === true
            );

            if (!hiveWorker) {
                const anyWorkers: [HiveWorker, any][] = this.registeredWorkers.filter(
                    (d: [HiveWorker, any]) => d[0].type === type && d[0].enabled === true
                );

                if (anyWorkers && anyWorkers.length > 0) {
                    hiveWorker = anyWorkers[0];
                } else {
                    return undefined;
                }
            }
        } else {
            hiveWorker = this.registeredWorkers.find(
                (d: [HiveWorker, any]) => d[0].type === type && d[0].name === name && d[0].enabled === true
            );

            if (!hiveWorker) {
                return undefined;
            }
        }

        return hiveWorker[1] as T;
    };

    public pushWorker = async (hiveWorker: HiveWorker): Promise<void> => {
        if (!hiveWorker.importPath || hiveWorker.importPath === "") {
            throw new Error(`Hive worker type ${hiveWorker.type} with name ${hiveWorker.name} has no import path`);
        }

        const newWorker: any = await AwaitHelper.execute<any>(import(hiveWorker.importPath));
        const newWorkerInstance: any = new newWorker.default();
        await AwaitHelper.execute<void>((newWorkerInstance as IHiveWorker).init(hiveWorker));
        await AwaitHelper.execute<void>((newWorkerInstance as IHiveWorker).afterInit());

        this.registeredWorkers.push([hiveWorker, newWorkerInstance]);
    };
}
