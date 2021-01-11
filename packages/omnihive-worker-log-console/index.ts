import { OmniHiveLogLevel } from "@withonevision/omnihive-hive-queen/enums/OmniHiveLogLevel";
import { ILogWorker } from "@withonevision/omnihive-hive-queen/interfaces/ILogWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-hive-queen/models/HiveWorkerBase";

export default class DefaultLogWorker extends HiveWorkerBase implements ILogWorker {

    public write = async (_logLevel: OmniHiveLogLevel, logString: string): Promise<void> => {
        console.log(logString);
    }

}

