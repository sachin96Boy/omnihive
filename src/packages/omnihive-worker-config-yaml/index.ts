/// <reference path="../../types/globals.omnihive.d.ts" />

import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { ObjectHelper } from "@withonevision/omnihive-core/helpers/ObjectHelper";
import { IConfigWorker } from "@withonevision/omnihive-core/interfaces/IConfigWorker";
import { HiveWorker } from "@withonevision/omnihive-core/models/HiveWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-core/models/HiveWorkerBase";
import { ServerSettings } from "@withonevision/omnihive-core/models/ServerSettings";
import fse from "fs-extra";
import { serializeError } from "serialize-error";
import yaml from "yaml";

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
            throw new Error("YAML Config Worker Init Error => " + JSON.stringify(serializeError(err)));
        }
    }

    public get = async (): Promise<ServerSettings> => {
        return ObjectHelper.create<ServerSettings>(ServerSettings, yaml.parse(this.readFile(this.configPath)));
    };

    public set = async (settings: ServerSettings): Promise<boolean> => {
        this.writeYamlToFile(this.configPath, settings);
        return true;
    };

    private readFile = (path: string): string => {
        return fse.readFileSync(path, { encoding: "utf8" });
    };

    private writeYamlToFile = (path: string, data: any): void => {
        fse.writeFileSync(path, yaml.stringify(data));
    };
}
