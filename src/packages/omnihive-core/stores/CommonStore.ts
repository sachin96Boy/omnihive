import { serializeError } from "serialize-error";
import { ServerStatus } from "../enums/ServerStatus";
import { AwaitHelper } from "../helpers/AwaitHelper";
import { IHiveWorker } from "../interfaces/IHiveWorker";
import { HiveAccount } from "../models/HiveAccount";
import { HiveWorker } from "../models/HiveWorker";
import { ServerSettings } from "../models/ServerSettings";
import { SystemStatus } from "../models/SystemStatus";
export class CommonStore {
    private static instance: CommonStore;

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    private constructor() {}

    public static getInstance = (): CommonStore => {
        if (!CommonStore.instance) {
            CommonStore.instance = new CommonStore();
        }

        return CommonStore.instance;
    };

    public static getNew = (): CommonStore => {
        return new CommonStore();
    };

    public account: HiveAccount = new HiveAccount();
    public settings: ServerSettings = new ServerSettings();
    public workers: [HiveWorker, any][] = [];

    private _status: SystemStatus = new SystemStatus();

    public get status(): SystemStatus {
        return this._status;
    }

    public changeSystemStatus = (serverStatus: ServerStatus, error?: Error): void => {
        const systemStatus: SystemStatus = new SystemStatus();
        systemStatus.serverStatus = serverStatus;

        if (error) {
            systemStatus.serverError = serializeError(error);
        } else {
            systemStatus.serverError = {};
        }

        this._status = systemStatus;
    };

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

                const newWorker: any = await AwaitHelper.execute<any>(import(hiveWorker.importPath));
                const newWorkerInstance: any = new newWorker.default();
                await AwaitHelper.execute<void>((newWorkerInstance as IHiveWorker).init(hiveWorker));

                this.workers.push([hiveWorker, newWorkerInstance]);
            }

            for (const worker of this.workers) {
                await AwaitHelper.execute<void>((worker[1] as IHiveWorker).afterInit());
            }
        } catch (err) {
            throw new Error("Worker Factory Init Error => " + JSON.stringify(serializeError(err)));
        }
    };

    public clearWorkers = (): void => {
        this.workers = [];
    };

    public getHiveWorker = async <T extends IHiveWorker | undefined>(
        type: string,
        name?: string
    ): Promise<T | undefined> => {
        if (this.workers.length === 0) {
            return undefined;
        }

        let hiveWorker: [HiveWorker, any] | undefined = undefined;

        if (!name) {
            hiveWorker = this.workers.find(
                (d: [HiveWorker, any]) => d[0].type === type && d[0].default === true && d[0].enabled === true
            );

            if (!hiveWorker) {
                const anyWorkers: [HiveWorker, any][] = this.workers.filter(
                    (d: [HiveWorker, any]) => d[0].type === type && d[0].enabled === true
                );

                if (anyWorkers && anyWorkers.length > 0) {
                    hiveWorker = anyWorkers[0];
                } else {
                    return undefined;
                }
            }
        } else {
            hiveWorker = this.workers.find(
                (d: [HiveWorker, any]) => d[0].type === type && d[0].name === name && d[0].enabled === true
            );

            if (!hiveWorker) {
                return undefined;
            }
        }

        return hiveWorker[1] as T;
    };

    public registerWorker = async (hiveWorker: HiveWorker): Promise<void> => {
        if (!hiveWorker.importPath || hiveWorker.importPath === "") {
            throw new Error(`Hive worker type ${hiveWorker.type} with name ${hiveWorker.name} has no import path`);
        }

        const newWorker: any = await AwaitHelper.execute<any>(import(hiveWorker.importPath));
        const newWorkerInstance: any = new newWorker.default();
        await AwaitHelper.execute<void>((newWorkerInstance as IHiveWorker).init(hiveWorker));
        await AwaitHelper.execute<void>((newWorkerInstance as IHiveWorker).afterInit());

        this.workers.push([hiveWorker, newWorkerInstance]);
    };
}
