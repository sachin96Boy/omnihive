
import { IFileSystemWorker } from "@withonevision/omnihive-public-queen/interfaces/IFileSystemWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-public-queen/models/HiveWorkerBase";
import fse from 'fs-extra';

export default class FileSystemWorker extends HiveWorkerBase implements IFileSystemWorker {

    public copyDirectory = (sourcePath: string, destPath: string): void => {
        fse.copySync(sourcePath, destPath);
    }

    public copyFile = (sourceFile: string, destFile: string): void => {
        fse.copyFileSync(sourceFile, destFile);
    }

    public directoryHasFiles = (path: string): boolean => {
        return fse.readdirSync(path).length > 0;
    }

    public pathExists = (path: string): boolean => {
        return fse.existsSync(path);
    }

    public ensureFolderExists = (path: string): void => {
        fse.ensureDirSync(path);
    }

    public getCurrentExecutionDirectory = (): string => {
        return process.cwd();
    }

    public getCurrentFileDirectory = (): string => {
        return __dirname;
    }

    public readFile = (path: string): string => {
        return fse.readFileSync(path, { encoding: "utf8" });
    }

    public readFileNamesFromDirectory = (path: string): string[] => {
        return fse.readdirSync(path);
    }

    public removeFile = (path: string): void => {
        fse.unlinkSync(path);
    }

    public removeFilesFromDirectory = (path: string): void => {
        fse.emptyDirSync(path);
    }

    public removeDirectory = (path: string): void => {
        if (this.pathExists(path)) {
            if (this.directoryHasFiles(path)) {
                this.removeFilesFromDirectory(path);
            }

            fse.rmdirSync(path);
        }
    }

    public writeDataToFile = (path: string, data: any): void => {
        fse.writeFileSync(path, Buffer.from(data));
    }

    public writeJsonToFile = (path: string, data: any): void => {
        fse.writeFileSync(path, JSON.stringify(data));
    }
}
