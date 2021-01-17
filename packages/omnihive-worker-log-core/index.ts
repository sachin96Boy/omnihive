import os from "os";
import dayjs from "dayjs";
import { HiveWorkerType } from "@withonevision/omnihive-common/enums/HiveWorkerType";
import { OmniHiveLogLevel } from "@withonevision/omnihive-common/enums/OmniHiveLogLevel";
import { AwaitHelper } from "@withonevision/omnihive-common/helpers/AwaitHelper";
import { ILogWorker } from "@withonevision/omnihive-common/interfaces/ILogWorker";
import { IPubSubServerWorker } from "@withonevision/omnihive-common/interfaces/IPubSubServerWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-common/models/HiveWorkerBase";
import { CommonStore } from "@withonevision/omnihive-common/stores/CommonStore";
import chalk from "chalk";

export default class LogWorkerServerDefault extends HiveWorkerBase implements ILogWorker {

    public logEntryNumber: number = 0;

    public write = async (logLevel: OmniHiveLogLevel, logString: string): Promise<void> => {

        const formattedLogString = `(${dayjs().format("YYYY-MM-DD HH:mm:ss")}) OmniHive Server ${os.hostname()} => ${logString}`;

        if (CommonStore.getInstance().settings.config.developerMode) {
            this.chalkConsole(logLevel, formattedLogString);
            return;
        }

        const adminPubSubServerWorkerName: string | undefined = CommonStore.getInstance().settings.constants["adminPubSubServerWorkerInstance"];

        const adminPubSubServer = await AwaitHelper.execute<IPubSubServerWorker | undefined>(
            CommonStore.getInstance().getHiveWorker<IPubSubServerWorker>(HiveWorkerType.PubSubServer, adminPubSubServerWorkerName));

        if (adminPubSubServer) {

            try {
                adminPubSubServer.emit(CommonStore.getInstance().settings.config.serverGroupName, "server-log-entry", { entryNumber: this.logEntryNumber, log: formattedLogString });
            } catch {
                this.chalkConsole(OmniHiveLogLevel.Warn, "Pub sub server log could not be synchronized");
            }

        }

        const logWorker: ILogWorker | undefined = await AwaitHelper.execute<ILogWorker | undefined>(CommonStore.getInstance().getHiveWorker<ILogWorker | undefined>(HiveWorkerType.Log));

        if (logWorker) {
            logWorker.write(logLevel, logString);
        }

        if (!logWorker || (logWorker && logWorker.config.package !== "@withonevision/omnihive-worker-log-console")) {
            this.chalkConsole(logLevel, formattedLogString);
        }

        if (this.logEntryNumber > 100000) {
            this.logEntryNumber = 0;
        }

        this.logEntryNumber++;
    }

    private chalkConsole = (logLevel: OmniHiveLogLevel, logString: string) => {
        switch (logLevel) {
            case OmniHiveLogLevel.Debug:
                console.log(chalk.green(logString));
                break;
            case OmniHiveLogLevel.Info:
                console.log(chalk.gray(logString));
                break;
            case OmniHiveLogLevel.Warn:
                console.log(chalk.yellow(logString));
                break;
            case OmniHiveLogLevel.Error:
                console.log(chalk.red(logString));
                break;
            default:
                console.log(logString);
                break;
        }
    }

}