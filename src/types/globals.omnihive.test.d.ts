declare global {
    declare namespace NodeJS {
        interface Global {
            omnihive: {
                getFilePath: (filePath: string) => string;
                getWorker: <T extends IHiveWorker | undefined>(type: string, name?: string) => T | undefined;
                ohDirName: string;
                registeredWorkers: RegisteredHiveWorker[];
            };
        }
    }
}
