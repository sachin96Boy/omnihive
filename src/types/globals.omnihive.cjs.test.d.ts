import { IHiveWorker } from "../common/omnihive-core-cjs/interfaces/IHiveWorker";
import { RegisteredHiveWorker } from "../common/omnihive-core-cjs/models/RegisteredHiveWorker";

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
