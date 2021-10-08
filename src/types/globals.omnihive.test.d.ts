import { IHiveWorker } from "../common/omnihive-core/interfaces/IHiveWorker";
import { RegisteredHiveWorker } from "../common/omnihive-core/models/RegisteredHiveWorker";

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
