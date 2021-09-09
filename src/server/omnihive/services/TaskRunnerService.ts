/// <reference path="../../../types/globals.omnihive.d.ts" />

import {
    AwaitHelper,
    HiveWorkerType,
    ILogWorker,
    IsHelper,
    OmniHiveLogLevel,
    RegisteredHiveWorker,
} from "@withonevision/omnihive-core/index.js";
import fse from "fs-extra";
import { serializeError } from "serialize-error";
import yaml from "yaml";
import { CommandLineArgs } from "../models/CommandLineArgs.js";
import { CommonService } from "./CommonService.js";

export class TaskRunnerService {
    public run = async (rootDir: string, commandLineArgs: CommandLineArgs): Promise<void> => {
        // Run boot and worker loader
        const commonService: CommonService = new CommonService();
        await AwaitHelper.execute(commonService.bootLoader(rootDir, commandLineArgs));
        await AwaitHelper.execute(commonService.workerLoader());

        // Get TaskWorker

        const taskWorker: RegisteredHiveWorker | undefined = global.omnihive.registeredWorkers.find(
            (rw: RegisteredHiveWorker) =>
                rw.name === commandLineArgs.taskRunnerWorker && rw.type === HiveWorkerType.TaskFunction
        );

        if (IsHelper.isNullOrUndefined(taskWorker)) {
            this.logError(
                commandLineArgs.taskRunnerWorker,
                new Error(
                    `Task Worker ${commandLineArgs.taskRunnerWorker} was not found in server configuration, is disabled, or is not of the right type`
                )
            );
            return;
        }

        // Set up worker args
        let workerArgs: any = null;

        if (
            !IsHelper.isNullOrUndefined(commandLineArgs.taskRunnerArgs) &&
            !IsHelper.isEmptyStringOrWhitespace(commandLineArgs.taskRunnerArgs)
        ) {
            try {
                workerArgs = JSON.parse(fse.readFileSync(commandLineArgs.taskRunnerArgs, { encoding: "utf8" }));
            } catch (error) {
                try {
                    workerArgs = yaml.parse(fse.readFileSync(commandLineArgs.taskRunnerArgs, { encoding: "utf8" }));
                } catch {
                    this.logError(commandLineArgs.taskRunnerWorker, error as Error);
                }
            }
        }

        // Try running the worker
        try {
            if (!IsHelper.isNullOrUndefined(workerArgs)) {
                await AwaitHelper.execute(taskWorker.instance.execute(workerArgs));
            } else {
                await AwaitHelper.execute(taskWorker.instance.execute());
            }
        } catch (error) {
            this.logError(commandLineArgs.taskRunnerWorker, error as Error);
        }

        process.exit();
    };

    private logError = async (workerName: string, err: Error) => {
        const logWorker: ILogWorker | undefined = globalThis.omnihive.getWorker<ILogWorker>(
            HiveWorkerType.Log,
            "__ohBootLogWorker"
        );

        logWorker?.write(
            OmniHiveLogLevel.Error,
            `Task Runner => ${workerName} => Error => ${JSON.stringify(serializeError(err))}`
        );

        throw new Error(`Task Runner => ${workerName} => Error => ${JSON.stringify(serializeError(err))}`);
    };
}
