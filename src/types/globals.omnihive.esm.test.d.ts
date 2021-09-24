import { IHiveWorker } from "../common/omnihive-core/interfaces/IHiveWorker.js";
import { RegisteredHiveWorker } from "../common/omnihive-core/models/RegisteredHiveWorker.js";

declare global {
    declare namespace globalThis {
        var omnihive: {
            getFilePath: (filePath: string) => string;
            getWorker: <T extends IHiveWorker | undefined>(type: string, name?: string) => T | undefined;
            ohDirName: string;
            registeredWorkers: RegisteredHiveWorker[];
        };
    }
}
