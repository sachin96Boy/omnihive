import { CoreServiceFactory } from "@withonevision/omnihive-core/factories/CoreServiceFactory";
import { IFeatureWorker } from "@withonevision/omnihive-core/interfaces/IFeatureWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-core/models/HiveWorkerBase";

export default class LocalFeatureWorker extends HiveWorkerBase implements IFeatureWorker {
    constructor() {
        super();
    }

    public get = async <T extends unknown>(name: string, defaultValue?: unknown): Promise<T | undefined> => {
        if (!name || name.length <= 0) {
            throw new Error("No feature name given.");
        }

        if (CoreServiceFactory.configurationService.settings.features[name]) {
            return CoreServiceFactory.configurationService.settings.features[name] as T;
        }

        if (defaultValue) {
            return defaultValue as T;
        } else {
            return undefined;
        }
    };
}
