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
            };
        }
    }
}
