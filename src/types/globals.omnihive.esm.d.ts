import express from "express";
import { Server } from "http";
import socketio from "socket.io";
import { OmniHiveClient } from "s@withonevision/omnihive-client-esm/index.js";
import {
    AdminEventType,
    AdminRoomType,
    CommandLineArgs,
    ConnectionSchema,
    HiveWorkerConfig,
    IHiveWorker,
    RegisteredHiveWorker,
    RegisteredHiveWorkerSection,
    RegisteredUrl,
    ServerConfig,
    ServerStatus,
} from "@withonevision/omnihive-core-esm/index.js";

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
