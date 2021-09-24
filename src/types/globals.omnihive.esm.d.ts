import express from "express";
import { Server } from "http";
import socketio from "socket.io";
import { OmniHiveClient } from "../common/omnihive-core-esm/client/OmniHiveClient.js";
import { AdminEventType } from "../common/omnihive-core-esm/enums/AdminEventType.js";
import { AdminRoomType } from "../common/omnihive-core-esm/enums/AdminRoomType.js";
import { RegisteredHiveWorkerSection } from "../common/omnihive-core-esm/enums/RegisteredHiveWorkerSection.js";
import { ServerStatus } from "../common/omnihive-core-esm/enums/ServerStatus.js";
import { IHiveWorker } from "../common/omnihive-core-esm/interfaces/IHiveWorker.js";
import { CommandLineArgs } from "../common/omnihive-core-esm/models/CommandLineArgs.js";
import { ConnectionSchema } from "../common/omnihive-core-esm/models/ConnectionSchema.js";
import { HiveWorkerConfig } from "../common/omnihive-core-esm/models/HiveWorkerConfig.js";
import { RegisteredHiveWorker } from "../common/omnihive-core-esm/models/RegisteredHiveWorker.js";
import { RegisteredUrl } from "../common/omnihive-core-esm/models/RegisteredUrl.js";
import { ServerConfig } from "../common/omnihive-core-esm/models/ServerConfig.js";

declare global {
    declare namespace globalThis {
        var omnihive: {
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
