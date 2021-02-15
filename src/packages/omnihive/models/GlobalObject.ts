/// <reference path="../../../types/globals.omnihive.d.ts" />

import { ServerStatus } from "@withonevision/omnihive-core/enums/ServerStatus";
import { IHiveWorker } from "@withonevision/omnihive-core/interfaces/IHiveWorker";
import { ConnectionSchema } from "@withonevision/omnihive-core/models/ConnectionSchema";
import { RegisteredHiveWorker } from "@withonevision/omnihive-core/models/RegisteredHiveWorker";
import { RegisteredUrl } from "@withonevision/omnihive-core/models/RegisteredUrl";
import { ServerSettings } from "@withonevision/omnihive-core/models/ServerSettings";
import { Server } from "http";
import express from "express";
import { HiveWorker } from "@withonevision/omnihive-core/models/HiveWorker";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { serializeError } from "serialize-error";
import { StringHelper } from "@withonevision/omnihive-core/helpers/StringHelper";
import path from "path";

export class GlobalObject {
    public appServer: express.Express | undefined = undefined;
    public ohDirName: string = "";
    public registeredSchemas: ConnectionSchema[] = [];
    public registeredUrls: RegisteredUrl[] = [];
    public registeredWorkers: RegisteredHiveWorker[] = [];
    public serverError: any = {};
    public serverSettings: ServerSettings = new ServerSettings();
    public serverStatus: ServerStatus = ServerStatus.Unknown;
    public webServer: Server | undefined = undefined;

    public getWorker<T extends IHiveWorker | undefined>(type: string, name?: string): T | undefined {
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
    }

    public async initWorkers(configs: HiveWorker[]): Promise<void> {
        try {
            for (const hiveWorker of configs) {
                await global.omnihive.pushWorker(hiveWorker);
            }

            for (const worker of global.omnihive.registeredWorkers) {
                (worker.instance as IHiveWorker).registeredWorkers = global.omnihive.registeredWorkers;
                (worker.instance as IHiveWorker).serverSettings = global.omnihive.serverSettings;
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

        const registeredWorker: RegisteredHiveWorker = { ...hiveWorker, instance: newWorkerInstance };
        let globalWorkers: RegisteredHiveWorker[] | undefined = global.omnihive.registeredWorkers;

        if (!globalWorkers) {
            globalWorkers = [];
        }

        globalWorkers.push(registeredWorker);
        global.omnihive.registeredWorkers = globalWorkers;
    }
}
