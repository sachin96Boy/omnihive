/// <reference path="../../../types/globals.omnihive.d.ts" />

import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { StringHelper } from "@withonevision/omnihive-core/helpers/StringHelper";
import { IHiveWorker } from "@withonevision/omnihive-core/interfaces/IHiveWorker";
import { HiveWorker } from "@withonevision/omnihive-core/models/HiveWorker";
import { RegisteredHiveWorker } from "@withonevision/omnihive-core/models/RegisteredHiveWorker";
import path from "path";
import { serializeError } from "serialize-error";

export class WorkerService {
    public initWorkers = async (configs: HiveWorker[]): Promise<void> => {
        try {
            for (const hiveWorker of configs) {
                await this.pushWorker(hiveWorker, false);
            }

            for (const worker of global.omnihive.registeredWorkers ?? []) {
                await AwaitHelper.execute<void>(
                    (worker.instance as IHiveWorker).afterInit(
                        global.omnihive.registeredWorkers,
                        global.omnihive.serverSettings
                    )
                );
            }
        } catch (err) {
            throw new Error("Worker Factory Init Error => " + JSON.stringify(serializeError(err)));
        }
    };

    public clearWorkers = (): void => {
        global.omnihive.registeredWorkers = [];
    };

    public getAllWorkers = (): RegisteredHiveWorker[] => {
        return global.omnihive.registeredWorkers ?? [];
    };

    public getWorker = <T extends IHiveWorker | undefined>(type: string, name?: string): T | undefined => {
        if (name) {
            const namedWorker: RegisteredHiveWorker | undefined = global.omnihive.registeredWorkers.find(
                (value: RegisteredHiveWorker) => value.name === name && value.type === type && value.enabled === true
            );

            if (namedWorker) {
                return namedWorker.instance as T;
            }

            return undefined;
        }

        const defaultWorker: RegisteredHiveWorker | undefined = global.omnihive.registeredWorkers.find(
            (value: RegisteredHiveWorker) => value.type === type && value.enabled === true && value.default === true
        );

        if (defaultWorker) {
            return defaultWorker.instance as T;
        }

        const anyWorkers: RegisteredHiveWorker[] | undefined = global.omnihive.registeredWorkers.filter(
            (value: RegisteredHiveWorker) => value.type === type && value.enabled === true
        );

        if (anyWorkers && anyWorkers.length > 0) {
            return anyWorkers[0].instance as T;
        }

        return undefined;
    };

    public getWorkersByType = (type: string): RegisteredHiveWorker[] => {
        return (
            global.omnihive.registeredWorkers?.filter(
                (rw: RegisteredHiveWorker) => rw.type === type && rw.enabled === true
            ) ?? []
        );
    };

    public pushWorker = async (hiveWorker: HiveWorker, runAfterInit: boolean = true): Promise<void> => {
        if (!hiveWorker.enabled) {
            return;
        }

        if (
            global.omnihive.registeredWorkers?.find((value: RegisteredHiveWorker) => {
                return value.name === hiveWorker.name;
            })
        ) {
            return;
        }

        if (!hiveWorker.importPath || hiveWorker.importPath === "") {
            throw new Error(`Hive worker type ${hiveWorker.type} with name ${hiveWorker.name} has no import path`);
        }

        if (hiveWorker.package === "") {
            if (!StringHelper.isNullOrWhiteSpace(global.omnihive.ohDirName)) {
                hiveWorker.importPath = path.join(global.omnihive.ohDirName, hiveWorker.importPath);
            } else {
                hiveWorker.importPath = path.join(process.cwd(), hiveWorker.importPath);
            }
        }

        const newWorker: any = await AwaitHelper.execute<any>(import(hiveWorker.importPath));
        const newWorkerInstance: any = new newWorker.default();
        await AwaitHelper.execute<void>((newWorkerInstance as IHiveWorker).init(hiveWorker));

        if (runAfterInit) {
            await AwaitHelper.execute<void>(
                (newWorkerInstance as IHiveWorker).afterInit(
                    global.omnihive.registeredWorkers,
                    global.omnihive.serverSettings
                )
            );
        }

        const registeredWorker: RegisteredHiveWorker = { ...hiveWorker, instance: newWorkerInstance };
        let globalWorkers: RegisteredHiveWorker[] | undefined = global.omnihive.registeredWorkers;

        if (!globalWorkers) {
            globalWorkers = [];
        }

        globalWorkers.push(registeredWorker);
        global.omnihive.registeredWorkers = globalWorkers;
    };
}
