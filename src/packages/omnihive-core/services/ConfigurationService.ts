/// <reference path="../globals.omnihive.core.d.ts" />

import { HiveAccount } from "../models/HiveAccount";
import { ServerSettings } from "../models/ServerSettings";

export class ConfigurationService {
    public get account(): HiveAccount {
        if (!global.omnihive.core.account) {
            global.omnihive.core.account = new HiveAccount();
        }

        return global.omnihive.core.account;
    }

    public set account(value: HiveAccount) {
        global.omnihive.core.account = value;
    }

    public get settings(): ServerSettings {
        if (!global.omnihive.core.serverSettings) {
            global.omnihive.core.serverSettings = new ServerSettings();
        }

        return global.omnihive.core.serverSettings;
    }

    public set settings(value: ServerSettings) {
        global.omnihive.core.serverSettings = value;
    }

    public get ohDirName(): string {
        if (!global.omnihive.core.ohDirName) {
            global.omnihive.core.ohDirName = "";
        }

        return global.omnihive.core.ohDirName;
    }

    public set ohDirName(value: string) {
        global.omnihive.core.ohDirName = value;
    }
}
