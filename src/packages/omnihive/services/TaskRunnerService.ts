import { NodeServiceFactory } from "@withonevision/omnihive-core-node/factories/NodeServiceFactory";
import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { OmniHiveLogLevel } from "@withonevision/omnihive-core/enums/OmniHiveLogLevel";
import { CoreServiceFactory } from "@withonevision/omnihive-core/factories/CoreServiceFactory";
import { StringHelper } from "@withonevision/omnihive-core/helpers/StringHelper";
import { IFileSystemWorker } from "@withonevision/omnihive-core/interfaces/IFileSystemWorker";
import { ILogWorker } from "@withonevision/omnihive-core/interfaces/ILogWorker";
import { HiveWorker } from "@withonevision/omnihive-core/models/HiveWorker";
import { ServerSettings } from "@withonevision/omnihive-core/models/ServerSettings";
import readPkgUp from "read-pkg-up";
import { serializeError } from "serialize-error";

export class TaskRunnerService {
    public run = async (settings: ServerSettings, worker: string, args: string): Promise<void> => {
        // Run basic app service
        const pkgJson: readPkgUp.NormalizedReadResult | undefined = await readPkgUp();
        await NodeServiceFactory.appService.initCore(pkgJson, settings);

        const fileSystemWorker:
            | IFileSystemWorker
            | undefined = await CoreServiceFactory.workerService.getWorker<IFileSystemWorker>(
            HiveWorkerType.FileSystem
        );

        if (!fileSystemWorker && args && !StringHelper.isNullOrWhiteSpace(args)) {
            throw new Error("FileSystem Worker Not Found...Cannot Read Args");
        }

        const logWorker: ILogWorker | undefined = await CoreServiceFactory.workerService.getWorker<ILogWorker>(
            HiveWorkerType.Log,
            "ohreqLogWorker"
        );

        if (!logWorker) {
            throw new Error("Core Log Worker Not Found.  Task Runner needs the core log worker ohreqLogWorker");
        }

        // Get TaskWorker

        const taskWorker: [HiveWorker, any] | undefined = CoreServiceFactory.workerService.registeredWorkers.find(
            (w: [HiveWorker, any]) =>
                w[0].name === worker && w[0].enabled === true && w[0].type === HiveWorkerType.TaskFunction
        );

        if (!taskWorker) {
            this.logError(
                worker,
                new Error(
                    `Task Worker ${worker} was not found in server configuration, is disabled, or is not of the right type`
                )
            );
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
    };

    private logError = async (workerName: string, err: Error) => {
        const logWorker: ILogWorker | undefined = await CoreServiceFactory.workerService.getWorker<ILogWorker>(
            HiveWorkerType.Log,
            "ohreqLogWorker"
        );

        if (!logWorker) {
            throw new Error("Core Log Worker Not Found.  Task Runner needs the core log worker ohreqLogWorker");
        }

        console.log(err);
        logWorker.write(
            OmniHiveLogLevel.Error,
            `Task Runner => ${workerName} => Error => ${JSON.stringify(serializeError(err))}`
        );
        throw new Error(`Task Runner => ${workerName} => Error => ${JSON.stringify(serializeError(err))}`);
    };
}
