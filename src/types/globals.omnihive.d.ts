import express from "express";
import { Server } from "http";
import socketio from "socket.io";
import { OmniHiveClient } from "src/server/omnihive-client";
import { AdminEventType } from "src/server/omnihive-core/enums/AdminEventType";
import { AdminRoomType } from "src/server/omnihive-core/enums/AdminRoomType";
import { RegisteredHiveWorkerSection } from "src/server/omnihive-core/enums/RegisteredHiveWorkerSection";
import { ServerStatus } from "src/server/omnihive-core/enums/ServerStatus";
import { IHiveWorker } from "src/server/omnihive-core/interfaces/IHiveWorker";
import { ConnectionSchema } from "src/server/omnihive-core/models/ConnectionSchema";
import { HiveWorkerConfig } from "src/server/omnihive-core/models/HiveWorkerConfig";
import { RegisteredHiveWorker } from "src/server/omnihive-core/models/RegisteredHiveWorker";
import { RegisteredUrl } from "src/server/omnihive-core/models/RegisteredUrl";
import { ServerConfig } from "src/server/omnihive-core/models/ServerConfig";
import { CommandLineArgs } from "src/server/omnihive/models/CommandLineArgs";

declare global {
    declare namespace NodeJS {
        interface Global {
            omnihive: {
                adminServer: socketio.Server | undefined;
                appServer: express.Express | undefined;
                checkWorkerImportPath: (hiveWorker: HiveWorkerConfig) => void;
                commandLineArgs: CommandLineArgs;
                emitToCluster: (event: AdminEventType, message?: any) => Promise<void>;
                emitToNamespace: (room: AdminRoomType, event: AdminEventType, message?: any) => Promise<void>;
                getEnvironmentVariable: <T extends string | number | boolean>(name: string) => T | undefined;
                getFilePath: (filePath: string) => string;
                getWorker: <T extends IHiveWorker | undefined>(type: string, name?: string) => T | undefined;
                initWorkers: () => Promise<void>;
                ohDirName: string;
                pushWorker: (hiveWorker: HiveWorkerConfig, section?: RegisteredHiveWorkerSection) => Promise<void>;
                registeredSchemas: ConnectionSchema[];
                registeredUrls: RegisteredUrl[];
                registeredWorkers: RegisteredHiveWorker[];
                serverClient: OmniHiveClient;
                serverConfig: ServerConfig;
                serverError: any;
                serverStatus: ServerStatus;
                webServer: Server | undefined;
            };
        }
    }
}
