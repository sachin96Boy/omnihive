/// <reference path="../../../types/globals.omnihive.d.ts" />

import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { OmniHiveLogLevel } from "@withonevision/omnihive-core/enums/OmniHiveLogLevel";
import { StringHelper } from "@withonevision/omnihive-core/helpers/StringHelper";
import { IFileSystemWorker } from "@withonevision/omnihive-core/interfaces/IFileSystemWorker";
import { ILogWorker } from "@withonevision/omnihive-core/interfaces/ILogWorker";
import { RegisteredHiveWorker } from "@withonevision/omnihive-core/models/RegisteredHiveWorker";
import chalk from "chalk";
import readPkgUp from "read-pkg-up";
import { serializeError } from "serialize-error";
import { AppService } from "./AppService";

export class TaskRunnerService {
    private logWorker!: ILogWorker;

    public run = async (worker: string, args: string): Promise<void> => {
        // Run basic app service
        const pkgJson: readPkgUp.NormalizedReadResult | undefined = await readPkgUp();
        const appService: AppService = new AppService();

        await appService.initCore(pkgJson);

        const fileSystemWorker: IFileSystemWorker | undefined = global.omnihive.getWorker<IFileSystemWorker>(
            HiveWorkerType.FileSystem
        );

        if (!fileSystemWorker && args && !StringHelper.isNullOrWhiteSpace(args)) {
            throw new Error("FileSystem Worker Not Found...Cannot Read Args");
        }

        const logWorker: ILogWorker | undefined = global.omnihive.getWorker<ILogWorker>(
            HiveWorkerType.Log,
            "ohreqLogWorker"
        );

        if (!logWorker) {
            throw new Error("Core Log Worker Not Found.  Task Runner needs the core log worker ohreqLogWorker");
        }

        this.logWorker = logWorker;

        // Get TaskWorker

        const taskWorker: RegisteredHiveWorker | undefined = global.omnihive.registeredWorkers.find(
            (rw: RegisteredHiveWorker) =>
                rw.name === worker && rw.enabled === true && rw.type === HiveWorkerType.TaskFunction
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
                await taskWorker.instance(workerArgs);
            } else {
                await taskWorker.instance();
            }
        } catch (err) {
            this.logError(worker, err);
        }

        console.log(chalk.greenBright("Done with task runner..."));
        process.exit();
    };

    private logError = async (workerName: string, err: Error) => {
        console.log(err);
        this.logWorker.write(
            OmniHiveLogLevel.Error,
            `Task Runner => ${workerName} => Error => ${JSON.stringify(serializeError(err))}`
        );
        throw new Error(`Task Runner => ${workerName} => Error => ${JSON.stringify(serializeError(err))}`);
    };
}
