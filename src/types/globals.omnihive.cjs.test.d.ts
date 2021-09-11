import { IHiveWorker, RegisteredHiveWorker } from "@withonevision/omnihive-core-cjs/index";

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
