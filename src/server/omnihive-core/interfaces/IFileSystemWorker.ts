import { IHiveWorker } from "./IHiveWorker.js";

export interface IFileSystemWorker extends IHiveWorker {
    copyDirectory: (sourcePath: string, destPath: string) => void;
    copyFile: (sourceFile: string, destFile: string) => void;
    directoryHasFiles: (path: string) => boolean;
    ensureFolderExists: (path: string) => void;
    readFile: (path: string) => string;
    readFileNamesFromDirectory: (path: string) => string[];
    removeFile: (path: string) => void;
    removeFilesFromDirectory: (path: string) => void;
    writeDataToFile: (path: string, data: any) => void;
    writeJsonToFile: (path: string, data: any) => void;
}
