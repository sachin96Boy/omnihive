/// <reference path="../../../types/globals.omnihive.d.ts" />

import { ServerStatus } from "@withonevision/omnihive-core/enums/ServerStatus";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { StringHelper } from "@withonevision/omnihive-core/helpers/StringHelper";
import { IHiveWorker } from "@withonevision/omnihive-core/interfaces/IHiveWorker";
import { ConnectionSchema } from "@withonevision/omnihive-core/models/ConnectionSchema";
import { HiveWorker } from "@withonevision/omnihive-core/models/HiveWorker";
import { RegisteredHiveWorker } from "@withonevision/omnihive-core/models/RegisteredHiveWorker";
import { RegisteredUrl } from "@withonevision/omnihive-core/models/RegisteredUrl";
import { WorkerSetterBase } from "@withonevision/omnihive-core/models/WorkerSetterBase";
import express from "express";
import { Server } from "http";
import path from "path";
import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { OmniHiveLogLevel } from "@withonevision/omnihive-core/enums/OmniHiveLogLevel";
import { ILogWorker } from "@withonevision/omnihive-core/interfaces/ILogWorker";
import { CommandLineArgs } from "./CommandLineArgs";
import { BootLoaderSettings } from "./BootLoaderSettings";
import socketIo from "socket.io";
import { AdminRoomType } from "@withonevision/omnihive-core/enums/AdminRoomType";
import { AdminEventType } from "@withonevision/omnihive-core/enums/AdminEventType";
import { AdminResponse } from "@withonevision/omnihive-core/models/AdminResponse";
import { AdminRequest } from "@withonevision/omnihive-core/models/AdminRequest";
import fse from "fs-extra";

export class GlobalObject extends WorkerSetterBase {
    public adminServer: socketIo.Server | undefined = undefined;
    public appServer: express.Express | undefined = undefined;
    public bootLoaderSettings: BootLoaderSettings = new BootLoaderSettings();
    public bootWorkerNames: string[] = [];
    public commandLineArgs: CommandLineArgs = new CommandLineArgs();
    public ohDirName: string = "";
    public registeredSchemas: ConnectionSchema[] = [];
    public registeredUrls: RegisteredUrl[] = [];
    public serverError: any = {};
    public serverStatus: ServerStatus = ServerStatus.Unknown;
    public webServer: Server | undefined = undefined;

    public emitToCluster = async (event: AdminEventType, message?: any): Promise<void> => {
        if (global.omnihive.adminServer) {
            const eventMessage: AdminRequest = {
                adminPassword: this.bootLoaderSettings.baseSettings.adminPassword,
                serverGroupId: this.bootLoaderSettings.baseSettings.serverGroupId,
                data: message,
            };

            global.omnihive.adminServer.emit(event, eventMessage);
        }
    };

    public emitToNamespace = async (room: AdminRoomType, event: AdminEventType, message?: any): Promise<void> => {
        if (global.omnihive.adminServer) {
            const eventMessage: AdminResponse = {
                serverGroupId: this.bootLoaderSettings.baseSettings.serverGroupId,
                requestComplete: true,
                requestError: undefined,
                data: message,
            };

            global.omnihive.adminServer
                .of(`/${global.omnihive.bootLoaderSettings.baseSettings.serverGroupId}`)
                .to(`${global.omnihive.bootLoaderSettings.baseSettings.serverGroupId}-${room}`)
                .emit(event, eventMessage);
        }
    };

    public getFilePath = (filePath: string): string => {
        let finalPath: string = "";

        if (!filePath || StringHelper.isNullOrWhiteSpace(filePath)) {
            return finalPath;
        }

        if (this.pathExists(filePath)) {
            finalPath = filePath;
        }

        if (
            StringHelper.isNullOrWhiteSpace(finalPath) &&
            this.pathExists(path.join(global.omnihive.ohDirName, filePath))
        ) {
            finalPath = path.join(global.omnihive.ohDirName, filePath);
        }

        if (
            StringHelper.isNullOrWhiteSpace(finalPath) &&
            !StringHelper.isNullOrWhiteSpace(global.omnihive.commandLineArgs.environmentFile) &&
            this.pathExists(path.join(path.parse(global.omnihive.commandLineArgs.environmentFile).dir, filePath))
        ) {
            finalPath = path.join(path.parse(global.omnihive.commandLineArgs.environmentFile).dir, filePath);
        }

        return finalPath;
    };

    public async pushWorker(hiveWorker: HiveWorker, isBoot: boolean = false, isCore: boolean = false): Promise<void> {
        const logWorker: ILogWorker | undefined = this.getWorker(HiveWorkerType.Log);

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

        if (!hiveWorker.importPath || hiveWorker.importPath === "") {
            throw new Error(`Hive worker type ${hiveWorker.type} with name ${hiveWorker.name} has no import path`);
        }

        if (hiveWorker.package === "") {
            if (!StringHelper.isNullOrWhiteSpace(this.ohDirName)) {
                hiveWorker.importPath = path.join(this.ohDirName, hiveWorker.importPath);
            } else {
                hiveWorker.importPath = path.join(process.cwd(), hiveWorker.importPath);
            }
        }

        let registerWorker: boolean = true;

        Object.keys(hiveWorker.metadata).forEach((metaKey: string) => {
            if (typeof hiveWorker.metadata[metaKey] === "string") {
                if (
                    (hiveWorker.metadata[metaKey] as string).startsWith("${") &&
                    (hiveWorker.metadata[metaKey] as string).endsWith("}")
                ) {
                    let metaValue: string = hiveWorker.metadata[metaKey] as string;

                    metaValue = metaValue.substr(2, metaValue.length - 3);

                    let envValue: unknown | undefined;

                    if (metaValue.includes("process.env.")) {
                        metaValue = metaValue.replace("process.env.", "");
                        envValue = process.env[metaValue];
                    } else {
                        envValue = global.omnihive.serverSettings.constants[metaValue];
                    }

                    if (envValue) {
                        hiveWorker.metadata[metaKey] = envValue;
                    } else {
                        registerWorker = false;
                        logWorker?.write(
                            OmniHiveLogLevel.Warn,
                            `Cannot register ${hiveWorker.name}...missing ${metaKey} in constants`
                        );
                    }
                }
            }
        });

        if (registerWorker) {
            const newWorker: any = await import(hiveWorker.importPath);
            const newWorkerInstance: any = new newWorker.default();
            await AwaitHelper.execute((newWorkerInstance as IHiveWorker).init(hiveWorker));

            const registeredWorker: RegisteredHiveWorker = {
                ...hiveWorker,
                instance: newWorkerInstance,
                isCore,
                isBoot,
            };
            this.registeredWorkers.push(registeredWorker);
        }
    }

    private pathExists = (path: string): boolean => {
        return fse.existsSync(path);
    };
}
