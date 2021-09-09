/// <reference path="../types/globals.omnihive.esm.test.d.ts" />

import { IHiveWorker, IsHelper, RegisteredHiveWorker } from "../common/omnihive-core-esm/index.js";

export class GlobalTestObject {
    public ohDirName: string = "";
    public registeredWorkers: RegisteredHiveWorker[] = [];

    public getFilePath = (filePath: string): string => {
        return filePath;
    };

    public getWorker<T extends IHiveWorker | undefined>(type: string, name?: string): T | undefined {
        if (!IsHelper.isNullOrUndefined(name)) {
            const namedWorker: RegisteredHiveWorker | undefined = this.registeredWorkers.find(
                (value: RegisteredHiveWorker) => value.name === name && value.type === type
            );

            if (!IsHelper.isNullOrUndefined(namedWorker)) {
                return namedWorker.instance as T;
            }

            return undefined;
        }

        const anyWorkers: RegisteredHiveWorker[] | undefined = this.registeredWorkers.filter(
            (value: RegisteredHiveWorker) => value.type === type
        );

        if (!IsHelper.isNullOrUndefined(anyWorkers) && !IsHelper.isEmptyArray(anyWorkers)) {
            return anyWorkers[0].instance as T;
        }

        return undefined;
    }
}
