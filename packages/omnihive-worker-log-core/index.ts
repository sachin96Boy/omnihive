import os from "os";
import dayjs from "dayjs";
import { HiveWorkerType } from "@withonevision/omnihive-queen/enums/HiveWorkerType";
import { OmniHiveLogLevel } from "@withonevision/omnihive-queen/enums/OmniHiveLogLevel";
import { AwaitHelper } from "@withonevision/omnihive-queen/helpers/AwaitHelper";
import { ILogWorker } from "@withonevision/omnihive-queen/interfaces/ILogWorker";
import { IPubSubServerWorker } from "@withonevision/omnihive-queen/interfaces/IPubSubServerWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-queen/models/HiveWorkerBase";
import { OmniHiveConstants } from "@withonevision/omnihive-queen/models/OmniHiveConstants";
import { QueenStore } from "@withonevision/omnihive-queen/stores/QueenStore";

export default class LogWorkerServerDefault extends HiveWorkerBase implements ILogWorker {

    public logEntryNumber: number = 0;

    public write = async (logLevel: OmniHiveLogLevel, logString: string): Promise<void> => {

        const formattedLogString = `(${dayjs().format("YYYY-MM-DD HH:mm:ss")}) OmniHive Server ${os.hostname()} => ${logString}`;

        if (QueenStore.getInstance().settings.server.developerMode) {
            console.log(formattedLogString);
            return;
        }

        const adminPubSubServer = await AwaitHelper.execute<IPubSubServerWorker | undefined>(
            QueenStore.getInstance().getHiveWorker<IPubSubServerWorker>(HiveWorkerType.PubSubServer, OmniHiveConstants.ADMIN_PUBSUB_SERVER_WORKER_INSTANCE));

        if (adminPubSubServer) {

            try {
                adminPubSubServer.emit(QueenStore.getInstance().settings.server.serverGroupName, "server-log-entry", { entryNumber: this.logEntryNumber, log: formattedLogString });
            } catch {
                console.log("Pub sub server log could not be synchronized");
            }

        }

        const logWorker: ILogWorker | undefined = await AwaitHelper.execute<ILogWorker | undefined>(QueenStore.getInstance().getHiveWorker<ILogWorker | undefined>(HiveWorkerType.Log));

        if (logWorker) {
            logWorker.write(logLevel, logString);
        }

        if (!logWorker || (logWorker && logWorker.config.package !== "@withonevision/omnihive-worker-log-console")) {
            console.log(formattedLogString);
        }

        if (this.logEntryNumber > 100000) {
            this.logEntryNumber = 0;
        }

        this.logEntryNumber++;
    }

}