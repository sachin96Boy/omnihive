import path from "path";
import { serializeError } from "serialize-error";
import { CoreServiceFactory } from "../factories/CoreServiceFactory";
import { AwaitHelper } from "../helpers/AwaitHelper";
import { StringHelper } from "../helpers/StringHelper";
import { IHiveWorker } from "../interfaces/IHiveWorker";
import { HiveWorker } from "../models/HiveWorker";
import { RegisteredHiveWorker } from "../models/RegisteredHiveWorker";

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

    public registeredWorkers: RegisteredHiveWorker[] = [];

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
                    if (!StringHelper.isNullOrWhiteSpace(CoreServiceFactory.configurationService.ohDirName)) {
                        hiveWorker.importPath = path.join(
                            CoreServiceFactory.configurationService.ohDirName,
                            hiveWorker.importPath
                        );
                    } else {
                        hiveWorker.importPath = path.join(process.cwd(), hiveWorker.importPath);
                    }
                }

                const newWorker: any = await AwaitHelper.execute<any>(import(hiveWorker.importPath));
                const newWorkerInstance: any = new newWorker.default();
                await AwaitHelper.execute<void>((newWorkerInstance as IHiveWorker).init(hiveWorker));

                const registeredWorker: RegisteredHiveWorker = { ...hiveWorker, instance: newWorkerInstance };
                this.registeredWorkers.push(registeredWorker);
            }

            for (const worker of this.registeredWorkers) {
                await AwaitHelper.execute<void>((worker.instance as IHiveWorker).afterInit());
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

        let hiveWorker: RegisteredHiveWorker | undefined = undefined;

        if (!name) {
            const defaultWorkers: RegisteredHiveWorker[] = this.registeredWorkers.filter(
                (rw: RegisteredHiveWorker) => rw.type === type && rw.default === true && rw.enabled === true
            );

            if (defaultWorkers.length > 1) {
                throw new Error("You cannot have multiple default workers of the same type");
            }

            if (defaultWorkers.length === 1) {
                hiveWorker = defaultWorkers[0];
            }

            if (!hiveWorker) {
                const anyWorkers: RegisteredHiveWorker[] = this.registeredWorkers.filter(
                    (rw: RegisteredHiveWorker) => rw.type === type && rw.enabled === true
                );

                if (anyWorkers && anyWorkers.length > 0) {
                    hiveWorker = anyWorkers[0];
                } else {
                    return undefined;
                }
            }
        } else {
            hiveWorker = this.registeredWorkers.find(
                (rw: RegisteredHiveWorker) => rw.type === type && rw.name === name && rw.enabled === true
            );

            if (!hiveWorker) {
                return undefined;
            }
        }

        return hiveWorker.instance as T;
    };

    public getWorkersByType = (type: string): RegisteredHiveWorker[] => {
        return this.registeredWorkers.filter((rw: RegisteredHiveWorker) => rw.type === type && rw.enabled === true);
    };

    public pushWorker = async (hiveWorker: HiveWorker): Promise<void> => {
        if (!hiveWorker.importPath || hiveWorker.importPath === "") {
            throw new Error(`Hive worker type ${hiveWorker.type} with name ${hiveWorker.name} has no import path`);
        }

        const newWorker: any = await AwaitHelper.execute<any>(import(hiveWorker.importPath));
        const newWorkerInstance: any = new newWorker.default();
        await AwaitHelper.execute<void>((newWorkerInstance as IHiveWorker).init(hiveWorker));
        await AwaitHelper.execute<void>((newWorkerInstance as IHiveWorker).afterInit());

        const registeredWorker: RegisteredHiveWorker = { ...hiveWorker, instance: newWorkerInstance };
        this.registeredWorkers.push(registeredWorker);
    };
}
