import { QueenStore } from "../stores/QueenStore";
import os from "os";
import dayjs from "dayjs";
import { OmniHiveLogLevel } from "@withonevision/omnihive-hive-common/enums/OmniHiveLogLevel";
import { AwaitHelper } from "@withonevision/omnihive-hive-common/helpers/AwaitHelper";
import { IPubSubServerWorker } from "@withonevision/omnihive-hive-worker/interfaces/IPubSubServerWorker";
import { HiveWorkerFactory } from "@withonevision/omnihive-hive-worker/HiveWorkerFactory";
import { ILogWorker } from "@withonevision/omnihive-hive-worker/interfaces/ILogWorker";
import { HiveWorkerType } from "@withonevision/omnihive-hive-common/enums/HiveWorkerType";
import { OmniHiveConstants } from "@withonevision/omnihive-hive-common/models/OmniHiveConstants";

export class LogService {

    private static instance: LogService;
    public logEntryNumber: number = 0;

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    private constructor() { }

    public static getInstance = (): LogService => {
        if (!LogService.instance) {
            LogService.instance = new LogService();
        }

        return LogService.instance;
    }

    public static getNew = (): LogService => {
        return new LogService();
    }

    public write = async (logLevel: OmniHiveLogLevel, logString: string): Promise<void> => {

        const formattedLogString = `(${dayjs().format("YYYY-MM-DD HH:mm:ss")}) OmniHive Server ${os.hostname()} => ${logString}`;

        if (QueenStore.getInstance().settings.server.developerMode) {
            console.log(formattedLogString);
            return;
        }

        let adminPubSubServer: IPubSubServerWorker | undefined = undefined;

        if (HiveWorkerFactory.getInstance().isInit) {
            adminPubSubServer = await AwaitHelper.execute<IPubSubServerWorker | undefined>(
                HiveWorkerFactory.getInstance().getHiveWorker<IPubSubServerWorker>(HiveWorkerType.PubSubServer, OmniHiveConstants.ADMIN_PUBSUB_SERVER_WORKER_INSTANCE));
        }

        if (adminPubSubServer) {

            try {
                adminPubSubServer.emit(QueenStore.getInstance().settings.server.serverGroupName, "server-log-entry", { entryNumber: this.logEntryNumber, log: formattedLogString });
            } catch {
                console.log("Pusher server log could not be synchronized");
            }

        }

        if (HiveWorkerFactory.getInstance().isInit) {
            const logWorker: ILogWorker | undefined = await AwaitHelper.execute<ILogWorker | undefined>(HiveWorkerFactory.getInstance().getHiveWorker<ILogWorker | undefined>(HiveWorkerType.Log));

            if (logWorker) {
                logWorker.write(logLevel, logString);
            }

            if (!logWorker || (logWorker && logWorker.config.package !== "@withonevision/omnihive-worker-log-console")) {
                console.log(formattedLogString);
            }
        } else {
            console.log(formattedLogString);
        }

        if (this.logEntryNumber > 100000) {
            this.logEntryNumber = 0;
        }

        this.logEntryNumber++;
    }

}