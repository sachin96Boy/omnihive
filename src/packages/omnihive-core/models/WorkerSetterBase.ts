import { serializeError } from "serialize-error";
import { AwaitHelper } from "../helpers/AwaitHelper";
import { IHiveWorker } from "../interfaces/IHiveWorker";
import { HiveWorker } from "./HiveWorker";
import { RegisteredHiveWorker } from "./RegisteredHiveWorker";
import { ServerSettings } from "./ServerSettings";
import { WorkerGetterBase } from "./WorkerGetterBase";

export abstract class WorkerSetterBase extends WorkerGetterBase {
    public serverSettings: ServerSettings = new ServerSettings();

    public async initWorkers(configs: HiveWorker[]): Promise<void> {
        try {
            for (const hiveWorker of configs) {
                await this.pushWorker(hiveWorker);
            }

            for (const worker of this.registeredWorkers) {
                (worker.instance as IHiveWorker).registeredWorkers = this.registeredWorkers;
                (worker.instance as IHiveWorker).serverSettings = this.serverSettings;
            }
        } catch (err) {
            throw new Error("Worker Factory Init Error => " + JSON.stringify(serializeError(err)));
        }
    }

    public async pushWorker(hiveWorker: HiveWorker): Promise<void> {
        if (!hiveWorker.enabled) {
            return;
        }

        if (
            this.registeredWorkers?.find((value: RegisteredHiveWorker) => {
                return value.name === hiveWorker.name;
            })
        ) {
            return;
        }

        if (
            !hiveWorker.importPath ||
            hiveWorker.importPath === "" ||
            !hiveWorker.package ||
            hiveWorker.package === ""
        ) {
            throw new Error(`Hive worker type ${hiveWorker.type} with name ${hiveWorker.name} has no import path`);
        }

        const newWorker: any = await AwaitHelper.execute<any>(import(hiveWorker.importPath));
        const newWorkerInstance: any = new newWorker.default();
        await AwaitHelper.execute<void>((newWorkerInstance as IHiveWorker).init(hiveWorker));

        const registeredWorker: RegisteredHiveWorker = { ...hiveWorker, instance: newWorkerInstance };
        this.registeredWorkers.push(registeredWorker);
    }
}
