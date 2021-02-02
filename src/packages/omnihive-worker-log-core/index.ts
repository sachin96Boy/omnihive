import { NodeServiceFactory } from "@withonevision/omnihive-core-node/factories/NodeServiceFactory";
import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { OmniHiveLogLevel } from "@withonevision/omnihive-core/enums/OmniHiveLogLevel";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { IFeatureWorker } from "@withonevision/omnihive-core/interfaces/IFeatureWorker";
import { ILogWorker } from "@withonevision/omnihive-core/interfaces/ILogWorker";
import { IPubSubServerWorker } from "@withonevision/omnihive-core/interfaces/IPubSubServerWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-core/models/HiveWorkerBase";
import chalk from "chalk";
import dayjs from "dayjs";
import os from "os";

export default class LogWorkerServerDefault extends HiveWorkerBase implements ILogWorker {
    public logEntryNumber: number = 0;
    public featureWorker!: IFeatureWorker | undefined;

    public async afterInit(): Promise<void> {
        this.featureWorker = await AwaitHelper.execute<IFeatureWorker | undefined>(
            NodeServiceFactory.workerService.getHiveWorker<IFeatureWorker | undefined>(HiveWorkerType.Feature)
        );

        if (!this.featureWorker) {
            throw new Error("Feature Worker Not Defined.  Log worker Will Not Function Without Feature Worker.");
        }
    }

    public write = async (logLevel: OmniHiveLogLevel, logString: string): Promise<void> => {
        const formattedLogString = `(${dayjs().format(
            "YYYY-MM-DD HH:mm:ss"
        )}) OmniHive Server ${os.hostname()} => ${logString}`;

        const consoleOnlyLogging: boolean = (await this.featureWorker?.get<boolean>("consoleOnlyLogging")) ?? false;

        if (consoleOnlyLogging) {
            this.chalkConsole(logLevel, formattedLogString);
            return;
        }

        const adminPubSubServerWorkerName: string | undefined =
            NodeServiceFactory.configurationService.settings.constants["adminPubSubServerWorkerInstance"];

        const adminPubSubServer = await AwaitHelper.execute<IPubSubServerWorker | undefined>(
            NodeServiceFactory.workerService.getHiveWorker<IPubSubServerWorker>(
                HiveWorkerType.PubSubServer,
                adminPubSubServerWorkerName
            )
        );

        if (adminPubSubServer) {
            try {
                adminPubSubServer.emit(
                    NodeServiceFactory.configurationService.settings.config.serverGroupName,
                    "server-log-entry",
                    {
                        entryNumber: this.logEntryNumber,
                        log: formattedLogString,
                    }
                );
            } catch {
                this.chalkConsole(OmniHiveLogLevel.Warn, "Pub sub server log could not be synchronized");
            }
        }

        const logWorker: ILogWorker | undefined = await AwaitHelper.execute<ILogWorker | undefined>(
            NodeServiceFactory.workerService.getHiveWorker<ILogWorker | undefined>(HiveWorkerType.Log)
        );

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
    };

    private chalkConsole = (logLevel: OmniHiveLogLevel, logString: string) => {
        switch (logLevel) {
            case OmniHiveLogLevel.Info:
                console.log(`${chalk.blueBright("info:")} ${logString}`);
                break;
            case OmniHiveLogLevel.Warn:
                console.log(`${chalk.yellow("warn:")} ${logString}`);
                break;
            case OmniHiveLogLevel.Error:
                console.log(`${chalk.red("error:")} ${logString}`);
                break;
            default:
                console.log(logString);
                break;
        }
    };
}
