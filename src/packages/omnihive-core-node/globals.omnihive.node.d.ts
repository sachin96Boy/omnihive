import { ServerStatus } from "@withonevision/omnihive-core/enums/ServerStatus";
import { RegisteredUrl } from "@withonevision/omnihive-core/models/RegisteredUrl";
import express from "express";
import { Server } from "http";
import { ConnectionSchema } from "./models/ConnectionSchema";
import { HiveAccount } from "./models/HiveAccount";
import { RegisteredHiveWorker } from "./models/RegisteredHiveWorker";
import { ServerSettings } from "./models/ServerSettings";

declare global {
    declare namespace NodeJS {
        interface Global {
            omnihive: {
                core: {
                    account: HiveAccount;
                    ohDirName: string;
                    registeredSchemas: ConnectionSchema[];
                    registeredWorkers: RegisteredHiveWorker[];
                    serverSettings: ServerSettings;
                };
                node: {
                    appServer: express.Express;
                    serverError: any;
                    serverStatus: ServerStatus;
                    registeredUrls: RegisteredUrl[];
                    webServer: Server | undefined;
                };
            };
        }
    }
}
