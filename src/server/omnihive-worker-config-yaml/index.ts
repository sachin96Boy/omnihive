/// <reference path="../../types/globals.omnihive.esm.d.ts" />

import {
    AwaitHelper,
    HiveWorkerBase,
    IConfigWorker,
    ObjectHelper,
    ServerConfig,
} from "@withonevision/omnihive-core-esm/index.js";
import fse from "fs-extra";
import yaml from "yaml";

export class JsonConfigWorkerMetadata {
    public configPath: string = "";
}

export default class JsonConfigWorker extends HiveWorkerBase implements IConfigWorker {
    private configPath: string = "";

    constructor() {
        super();
    }

    public async init(name: string, metadata?: any): Promise<void> {
        await AwaitHelper.execute(super.init(name, metadata));
        const typedMetadata: JsonConfigWorkerMetadata = this.checkObjectStructure<JsonConfigWorkerMetadata>(
            JsonConfigWorkerMetadata,
            metadata
        );

        this.configPath = global.omnihive.getFilePath(typedMetadata.configPath);

        if (!fse.existsSync(this.configPath)) {
            throw new Error("Config path cannot be found");
        }
    }

    public get = async (): Promise<ServerConfig> => {
        const loadedFile = ObjectHelper.create<ServerConfig>(
            ServerConfig,
            yaml.parse(fse.readFileSync(this.configPath, { encoding: "utf8" }))
        );

        loadedFile.environmentVariables.forEach((value) => {
            value.isSystem = false;
        });

        return loadedFile;
    };

    public set = async (serverConfig: ServerConfig): Promise<boolean> => {
        serverConfig.environmentVariables.forEach((value) => {
            delete value.isSystem;
        });

        fse.writeFileSync(this.configPath, yaml.stringify(serverConfig));
        return true;
    };
}
