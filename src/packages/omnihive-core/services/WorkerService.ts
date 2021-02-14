/// <reference path="../globals.omnihive.core.d.ts" />

import path from "path";
import { serializeError } from "serialize-error";
import { CoreServiceFactory } from "../factories/CoreServiceFactory";
import { AwaitHelper } from "../helpers/AwaitHelper";
import { StringHelper } from "../helpers/StringHelper";
import { IHiveWorker } from "../interfaces/IHiveWorker";
import { HiveWorker } from "../models/HiveWorker";
import { RegisteredHiveWorker } from "../models/RegisteredHiveWorker";

export class WorkerService {
    public initWorkers = async (configs: HiveWorker[]): Promise<void> => {
        try {
            for (const hiveWorker of configs) {
                await this.pushWorker(hiveWorker, false);
            }

            for (const worker of global.omnihive.core.registeredWorkers ?? []) {
                await AwaitHelper.execute<void>((worker.instance as IHiveWorker).afterInit());
            }
        } catch (err) {
            throw new Error("Worker Factory Init Error => " + JSON.stringify(serializeError(err)));
        }
    };

    public clearWorkers = (): void => {
        global.omnihive.core.registeredWorkers = [];
    };

    public getAllWorkers = (): RegisteredHiveWorker[] => {
        return global.omnihive.core.registeredWorkers ?? [];
    };

    public getWorker = async <T extends IHiveWorker | undefined>(
        type: string,
        name?: string
    ): Promise<T | undefined> => {
        if (global.omnihive.core.registeredWorkers?.length === 0) {
            return undefined;
        }

        let hiveWorker: RegisteredHiveWorker | undefined = undefined;

        if (!name) {
            const defaultWorkers: RegisteredHiveWorker[] | undefined = global.omnihive.core.registeredWorkers?.filter(
                (rw: RegisteredHiveWorker) => rw.type === type && rw.default === true && rw.enabled === true
            );

            if (defaultWorkers && defaultWorkers.length > 1) {
                throw new Error("You cannot have multiple default workers of the same type");
            }

            if (defaultWorkers && defaultWorkers.length === 1) {
                hiveWorker = defaultWorkers[0];
            }

            if (!hiveWorker) {
                const anyWorkers: RegisteredHiveWorker[] | undefined = global.omnihive.core.registeredWorkers?.filter(
                    (rw: RegisteredHiveWorker) => rw.type === type && rw.enabled === true
                );

                if (anyWorkers && anyWorkers.length > 0) {
                    hiveWorker = anyWorkers[0];
                } else {
                    return undefined;
                }
            }
        } else {
            hiveWorker = global.omnihive.core.registeredWorkers?.find(
                (rw: RegisteredHiveWorker) => rw.type === type && rw.name === name && rw.enabled === true
            );

            if (!hiveWorker) {
                return undefined;
            }
        }

        return hiveWorker.instance as T;
    };

    public getWorkersByType = (type: string): RegisteredHiveWorker[] => {
        return (
            global.omnihive.core.registeredWorkers?.filter(
                (rw: RegisteredHiveWorker) => rw.type === type && rw.enabled === true
            ) ?? []
        );
    };

    public pushWorker = async (hiveWorker: HiveWorker, runAfterInit: boolean = true): Promise<void> => {
        if (!hiveWorker.enabled) {
            return;
        }

        if (
            global.omnihive.core.registeredWorkers?.find((value: RegisteredHiveWorker) => {
                return value.name === hiveWorker.name;
            })
        ) {
            return;
        }

        if (!hiveWorker.importPath || hiveWorker.importPath === "") {
            throw new Error(`Hive worker type ${hiveWorker.type} with name ${hiveWorker.name} has no import path`);
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

        if (runAfterInit) {
            await AwaitHelper.execute<void>((newWorkerInstance as IHiveWorker).afterInit());
        }

        const registeredWorker: RegisteredHiveWorker = { ...hiveWorker, instance: newWorkerInstance };
        let globalWorkers: RegisteredHiveWorker[] | undefined = global.omnihive.core.registeredWorkers;

        if (!globalWorkers) {
            globalWorkers = [];
        }

        globalWorkers.push(registeredWorker);
        global.omnihive.core.registeredWorkers = globalWorkers;
    };
}
