import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { OmniHiveLogLevel } from "@withonevision/omnihive-core/enums/OmniHiveLogLevel";
import { CoreServiceFactory } from "@withonevision/omnihive-core/factories/CoreServiceFactory";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { IFeatureWorker } from "@withonevision/omnihive-core/interfaces/IFeatureWorker";
import { ILogWorker } from "@withonevision/omnihive-core/interfaces/ILogWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-core/models/HiveWorkerBase";
import { RegisteredHiveWorker } from "@withonevision/omnihive-core/models/RegisteredHiveWorker";
import chalk from "chalk";
import dayjs from "dayjs";
import os from "os";
import { serializeError } from "serialize-error";

export default class LogWorkerServerDefault extends HiveWorkerBase implements ILogWorker {
    public logEntryNumber: number = 0;
    public featureWorker!: IFeatureWorker | undefined;

    public async afterInit(): Promise<void> {
        this.featureWorker = await AwaitHelper.execute<IFeatureWorker | undefined>(
            CoreServiceFactory.workerService.getWorker<IFeatureWorker | undefined>(HiveWorkerType.Feature)
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

        const logWorkers: RegisteredHiveWorker[] = CoreServiceFactory.workerService.getWorkersByType(
            HiveWorkerType.Log
        );

        logWorkers.forEach((value: RegisteredHiveWorker) => {
            try {
                (value.instance as ILogWorker).write(logLevel, formattedLogString);
            } catch (e) {
                this.chalkConsole(
                    OmniHiveLogLevel.Error,
                    `Skipping logging for ${value.name} due to error: ${serializeError(e)}`
                );
            }
        });

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
