/// <reference path="../../../types/globals.omnihive.d.ts" />

import { ServerStatus } from "@withonevision/omnihive-core/enums/ServerStatus";
import { IHiveWorker } from "@withonevision/omnihive-core/interfaces/IHiveWorker";
import { ConnectionSchema } from "@withonevision/omnihive-core/models/ConnectionSchema";
import { RegisteredHiveWorker } from "@withonevision/omnihive-core/models/RegisteredHiveWorker";
import { RegisteredUrl } from "@withonevision/omnihive-core/models/RegisteredUrl";
import { ServerSettings } from "@withonevision/omnihive-core/models/ServerSettings";
import { Server } from "http";
import express from "express";

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
}
