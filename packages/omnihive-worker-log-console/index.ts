import { OmniHiveLogLevel } from "@withonevision/omnihive-common/enums/OmniHiveLogLevel";
import { ILogWorker } from "@withonevision/omnihive-common/interfaces/ILogWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-common/models/HiveWorkerBase";

export default class DefaultLogWorker extends HiveWorkerBase implements ILogWorker {

    public write = async (_logLevel: OmniHiveLogLevel, logString: string): Promise<void> => {
        console.log(logString);
    }

}

