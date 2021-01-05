import { OmniHiveLogLevel } from "@withonevision/omnihive-hive-common/enums/OmniHiveLogLevel";
import { ILogWorker } from "@withonevision/omnihive-hive-worker/interfaces/ILogWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-hive-worker/models/HiveWorkerBase";


export default class DefaultLogWorker extends HiveWorkerBase implements ILogWorker {

    public write = async (_logLevel: OmniHiveLogLevel, logString: string): Promise<void> => {
        console.log(logString);
    }

}

