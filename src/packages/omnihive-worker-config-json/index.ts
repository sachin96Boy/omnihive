/// <reference path="../../types/globals.omnihive.d.ts" />

import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { ObjectHelper } from "@withonevision/omnihive-core/helpers/ObjectHelper";
import { IConfigWorker } from "@withonevision/omnihive-core/interfaces/IConfigWorker";
import { HiveWorker } from "@withonevision/omnihive-core/models/HiveWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-core/models/HiveWorkerBase";
import fse from "fs-extra";
import { serializeError } from "serialize-error";
import { AppSettings } from "@withonevision/omnihive-core/models/AppSettings";

export class JsonConfigWorkerMetadata {
    public configPath: string = "";
}

export default class JsonConfigWorker extends HiveWorkerBase implements IConfigWorker {
    private configPath: string = "";

    constructor() {
        super();
    }

    public async init(config: HiveWorker): Promise<void> {
        try {
            await AwaitHelper.execute(super.init(config));
            const metadata: JsonConfigWorkerMetadata = this.checkObjectStructure<JsonConfigWorkerMetadata>(
                JsonConfigWorkerMetadata,
                config.metadata
            );

            this.configPath = global.omnihive.getFilePath(metadata.configPath);

            if (!fse.existsSync(this.configPath)) {
                throw new Error("Config path cannot be found");
            }
        } catch (err) {
            throw new Error("Json Config Worker Init Error => " + JSON.stringify(serializeError(err)));
        }
    }

    public get = async (): Promise<AppSettings> => {
        return ObjectHelper.create<AppSettings>(AppSettings, JSON.parse(this.readFile(this.configPath)));
    };

    public set = async (settings: AppSettings): Promise<boolean> => {
        this.writeJsonToFile(this.configPath, settings);
        return true;
    };

    private readFile = (path: string): string => {
        return fse.readFileSync(path, { encoding: "utf8" });
    };

    private writeJsonToFile = (path: string, data: any): void => {
        fse.writeFileSync(path, JSON.stringify(data));
    };
}
