import express from "express";
import { Server } from "http";
import socketio from "socket.io";
import { OmniHiveClient } from "../common/omnihive-core/client/OmniHiveClient";
import { AdminEventType } from "../common/omnihive-core/enums/AdminEventType";
import { AdminRoomType } from "../common/omnihive-core/enums/AdminRoomType";
import { RegisteredHiveWorkerSection } from "../common/omnihive-core/enums/RegisteredHiveWorkerSection";
import { ServerStatus } from "../common/omnihive-core/enums/ServerStatus";
import { IHiveWorker } from "../common/omnihive-core/interfaces/IHiveWorker";
import { CommandLineArgs } from "../common/omnihive-core/models/CommandLineArgs";
import { ConnectionSchema } from "../common/omnihive-core/models/ConnectionSchema";
import { HiveWorkerConfig } from "../common/omnihive-core/models/HiveWorkerConfig";
import { RegisteredHiveWorker } from "../common/omnihive-core/models/RegisteredHiveWorker";
import { RegisteredUrl } from "../common/omnihive-core/models/RegisteredUrl";
import { ServerConfig } from "../common/omnihive-core/models/ServerConfig";

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
