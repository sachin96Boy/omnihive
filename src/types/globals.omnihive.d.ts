import { ServerStatus } from "src/packages/omnihive-core/enums/ServerStatus";
import { RegisteredUrl } from "src/packages/omnihive-core/models/RegisteredUrl";
import express from "express";
import { Server } from "http";
import { ConnectionSchema } from "src/packages/omnihive-core/models/ConnectionSchema";
import { RegisteredHiveWorker } from "src/packages/omnihive-core/models/RegisteredHiveWorker";
import { AppSettings } from "src/packages/omnihive-core/models/AppSettings";
import { IHiveWorker } from "src/packages/omnihive-core/interfaces/IHiveWorker";
import { CommandLineArgs } from "src/packages/omnihive/models/CommandLineArgs";
import { AdminRoomType } from "src/packages/omnihive-core/enums/AdminRoomType";
import { AdminEventType } from "src/packages/omnihive-core/enums/AdminEventType";
import { HiveWorker } from "src/packages/omnihive-core/models/HiveWorker";
import socketio from "socket.io";

declare global {
    declare namespace NodeJS {
        interface Global {
            omnihive: {
                adminServer: socketio.Server | undefined;
                appServer: express.Express | undefined;
                appSettings: AppSettings;
                checkWorkerImportPath: (hiveWorker: HiveWorker) => void;
                commandLineArgs: CommandLineArgs;
                emitToCluster: (event: AdminEventType, message?: any) => Promise<void>;
                emitToNamespace: (room: AdminRoomType, event: AdminEventType, message?: any) => Promise<void>;
                getEnvironmentVariable: <T extends string | number | boolean>(name: string) => T | undefined;
                getFilePath: (filePath: string) => string;
                getWorker: <T extends IHiveWorker | undefined>(type: string, name?: string) => T | undefined;
                initWorkers: (appSettings: AppSettings) => Promise<void>;
                ohDirName: string;
                pushWorker: (hiveWorker: HiveWorker, isBoot: boolean = false, isCore: boolean = false) => Promise<void>;
                registeredSchemas: ConnectionSchema[];
                registeredUrls: RegisteredUrl[];
                registeredWorkers: RegisteredHiveWorker[];
                serverError: any;
                serverStatus: ServerStatus;
                webServer: Server | undefined;
            };
        }
    }
}
