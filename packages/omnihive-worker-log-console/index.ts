import { OmniHiveLogLevel } from "@withonevision/omnihive-public-queen/enums/OmniHiveLogLevel";
import { ILogWorker } from "@withonevision/omnihive-public-queen/interfaces/ILogWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-public-queen/models/HiveWorkerBase";

export default class DefaultLogWorker extends HiveWorkerBase implements ILogWorker {

    public write = async (_logLevel: OmniHiveLogLevel, logString: string): Promise<void> => {
        console.log(logString);
    }

}

