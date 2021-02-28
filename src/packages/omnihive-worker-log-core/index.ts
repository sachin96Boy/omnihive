import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { OmniHiveLogLevel } from "@withonevision/omnihive-core/enums/OmniHiveLogLevel";
import { IFeatureWorker } from "@withonevision/omnihive-core/interfaces/IFeatureWorker";
import { ILogWorker } from "@withonevision/omnihive-core/interfaces/ILogWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-core/models/HiveWorkerBase";
import { RegisteredHiveWorker } from "@withonevision/omnihive-core/models/RegisteredHiveWorker";
import chalk from "chalk";
import dayjs from "dayjs";
import os from "os";
import { serializeError } from "serialize-error";

export default class LogWorkerServerDefault extends HiveWorkerBase implements ILogWorker {
    constructor() {
        super();
    }

    public write = async (logLevel: OmniHiveLogLevel, logString: string): Promise<void> => {
        let featureWorker: IFeatureWorker | undefined = undefined;
        let consoleOnlyLogging: boolean = true;

        try {
            featureWorker = global.omnihive.getWorker<IFeatureWorker | undefined>(HiveWorkerType.Feature);
        } catch {
            featureWorker = undefined;
        }

        const formattedLogString = `(${dayjs().format(
            "YYYY-MM-DD HH:mm:ss"
        )}) OmniHive Server ${os.hostname()} => ${logString}`;

        try {
            (await featureWorker?.get<boolean>("consoleOnlyLogging")) ?? true;
        } catch {
            consoleOnlyLogging = true;
        }

        global.omnihive.adminServer.sockets.emit("log-response", { logLevel, logString: formattedLogString });

        if (consoleOnlyLogging) {
            this.chalkConsole(logLevel, formattedLogString);
            return;
        }

        const logWorkers: RegisteredHiveWorker[] = global.omnihive.registeredWorkers.filter(
            (value: RegisteredHiveWorker) => {
                return value.enabled === true && value.type === HiveWorkerType.Log && value.name !== "ohreqLogWorker";
            }
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
