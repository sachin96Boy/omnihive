import fse from "fs-extra";
import path from "path";
import { StringHelper } from "./StringHelper";

export class FileHelper {
    public getFilePath = (filePath: string) => {
        let finalPath: string = "";

        try {
            if (!filePath || StringHelper.isNullOrWhiteSpace(filePath)) {
                throw new Error("File path is not defined");
            }

            if (this.pathExists(filePath)) {
                finalPath = filePath;
            }

            if (
                StringHelper.isNullOrWhiteSpace(finalPath) &&
                this.pathExists(path.join(global.omnihive.ohDirName, filePath))
            ) {
                finalPath = path.join(global.omnihive.ohDirName, filePath);
            }

            if (
                StringHelper.isNullOrWhiteSpace(finalPath) &&
                !StringHelper.isNullOrWhiteSpace(global.omnihive.commandLineArgs.environmentFile) &&
                this.pathExists(path.join(path.parse(global.omnihive.commandLineArgs.environmentFile).dir, filePath))
            ) {
                finalPath = path.join(path.parse(global.omnihive.commandLineArgs.environmentFile).dir, filePath);
            }

            return finalPath;
        } catch (err) {
            throw new Error(err);
        }
    };

    private pathExists = (path: string): boolean => {
        return fse.existsSync(path);
    };
}
