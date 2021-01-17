import { HiveWorkerType } from "@withonevision/omnihive-common/enums/HiveWorkerType";
import { OmniHiveLogLevel } from "@withonevision/omnihive-common/enums/OmniHiveLogLevel";
import { StringHelper } from "@withonevision/omnihive-common/helpers/StringHelper";
import { IFileSystemWorker } from "@withonevision/omnihive-common/interfaces/IFileSystemWorker";
import { ILogWorker } from "@withonevision/omnihive-common/interfaces/ILogWorker";
import { HiveWorker } from "@withonevision/omnihive-common/models/HiveWorker";
import { ServerSettings } from "@withonevision/omnihive-common/models/ServerSettings";
import { CommonStore } from "@withonevision/omnihive-common/stores/CommonStore";
import { serializeError } from "serialize-error";
import { AppHelper } from "../helpers/AppHelper";

export class TaskRunnerService {

    public start = async (name: string | undefined, settings: string | undefined, worker: string, args: string): Promise<void> => {

        // Run basic app service
        const appHelper: AppHelper = new AppHelper();
        const appSettings: ServerSettings = appHelper.getServerSettings(name, settings);
        await appHelper.initApp(appSettings);

        const fileSystemWorker: IFileSystemWorker | undefined = await CommonStore.getInstance().getHiveWorker<IFileSystemWorker>(HiveWorkerType.FileSystem);

        if (!fileSystemWorker && args && !StringHelper.isNullOrWhiteSpace(args)) {
            throw new Error("FileSystem Worker Not Found...Cannot Read Args")
        }

        const logWorker: ILogWorker | undefined = await CommonStore.getInstance().getHiveWorker<ILogWorker>(HiveWorkerType.Log, "ohreqLogWorker");

        if (!logWorker) {
            throw new Error("Core Log Worker Not Found.  Task Runner needs the core log worker ohreqLogWorker");
        }

        // Get TaskWorker

        const taskWorker: [HiveWorker, any] | undefined = CommonStore.getInstance().workers.find((w: [HiveWorker, any]) => w[0].name === worker && w[0].enabled === true && w[0].type === HiveWorkerType.TaskFunction);

        if (!taskWorker) {
            this.logError(worker, new Error(`Task Worker ${worker} was not found in server configuration, is disabled, or is not of the right type`));
            return;
        }

        // Set up worker args
        let workerArgs: any = null;

        if (args && args !== "") {
            try {
                if (fileSystemWorker) {
                    workerArgs = JSON.parse(fileSystemWorker.readFile(args));
                }
            } catch (err) {
                this.logError(worker, err);
            }
        }

        // Try running the worker
        try {
            if (!(workerArgs === null || workerArgs === undefined)) {
                await taskWorker[1](workerArgs);
            } else {
                await taskWorker[1]();
            }

        } catch (err) {
            this.logError(worker, err);
        }
    }

    private logError = async (workerName: string, err: Error) => {

        const logWorker: ILogWorker | undefined = await CommonStore.getInstance().getHiveWorker<ILogWorker>(HiveWorkerType.Log, "ohreqLogWorker");

        if (!logWorker) {
            throw new Error("Core Log Worker Not Found.  Task Runner needs the core log worker ohreqLogWorker");
        }

        console.log(err);
        logWorker.write(OmniHiveLogLevel.Error, `Task Runner => ${workerName} => Error => ${JSON.stringify(serializeError(err))}`);
        throw new Error(`Task Runner => ${workerName} => Error => ${JSON.stringify(serializeError(err))}`);
    }
}