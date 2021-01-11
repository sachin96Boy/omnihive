import { HiveWorkerType } from "@withonevision/omnihive-hive-queen/enums/HiveWorkerType";
import { OmniHiveLogLevel } from "@withonevision/omnihive-hive-queen/enums/OmniHiveLogLevel";
import { AwaitHelper } from "@withonevision/omnihive-hive-queen/helpers/AwaitHelper";
import { StringHelper } from "@withonevision/omnihive-hive-queen/helpers/StringHelper";
import { IFileSystemWorker } from "@withonevision/omnihive-hive-queen/interfaces/IFileSystemWorker";
import { ILogWorker } from "@withonevision/omnihive-hive-queen/interfaces/ILogWorker";
import { HiveWorker } from "@withonevision/omnihive-hive-queen/models/HiveWorker";
import { QueenStore } from "@withonevision/omnihive-hive-queen/stores/QueenStore";
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import minimist from "minimist";
import readPkgUp, { NormalizedReadResult } from "read-pkg-up";
import { serializeError } from "serialize-error";
import { NodeStore } from "./stores/NodeStore";

// Set up args and variables
const args = minimist(process.argv.slice(2));

const argWorkerName: string = args._[0];
const argFile: string = args._[1];

async function taskRunner(workerName: string, argsFile: string) {

    if (!process.env.OH_ENV_FILE) {
        throw new Error("Please provide a file path to the OmniHive Environment File (OH_ENV_FILE)");
    }

    dotenvExpand(dotenv.config({ path: process.env.OH_ENV_FILE }));

    const packageJson: NormalizedReadResult | undefined = await AwaitHelper.execute<NormalizedReadResult | undefined>(readPkgUp());

    await NodeStore.getInstance().initApp(process.env.OH_SERVER_SETTINGS, packageJson);

    const fileSystemWorker: IFileSystemWorker | undefined = await QueenStore.getInstance().getHiveWorker<IFileSystemWorker>(HiveWorkerType.FileSystem);

    if (!fileSystemWorker && argsFile && !StringHelper.isNullOrWhiteSpace(argFile)) {
        throw new Error("FileSystem Worker Not Found...Cannot Read Args")
    }

    const logWorker: ILogWorker | undefined = await QueenStore.getInstance().getHiveWorker<ILogWorker>(HiveWorkerType.Log, "ohreqLogWorker");

    if (!logWorker) {
        throw new Error("Core Log Worker Not Found.  Task Runner needs the core log worker ohreqLogWorker");
    }

    // Get TaskWorker

    const taskWorker: [HiveWorker, any] | undefined = QueenStore.getInstance().workers.find((w: [HiveWorker, any]) => w[0].name === workerName && w[0].enabled === true && w[0].type === HiveWorkerType.TaskFunction);

    if (!taskWorker) {
        logError(workerName, new Error(`Task Worker ${workerName} was not found in server configuration, is disabled, or is not of the right type`));
        return;
    }

    // Set up worker args
    let workerArgs: any = null;

    if (argsFile && argsFile !== "") {
        try {
            if (fileSystemWorker) {
                workerArgs = JSON.parse(fileSystemWorker.readFile(argFile));
            }
        } catch (err) {
            logError(workerName, err);
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
        logError(workerName, err);
    }
}

async function logError(workerName: string, err: Error) {

    const logWorker: ILogWorker | undefined = await QueenStore.getInstance().getHiveWorker<ILogWorker>(HiveWorkerType.Log, "ohreqLogWorker");

    if (!logWorker) {
        throw new Error("Core Log Worker Not Found.  Task Runner needs the core log worker ohreqLogWorker");
    }

    console.log(err);
    logWorker.write(OmniHiveLogLevel.Error, `Task Runner => ${workerName} => Error => ${JSON.stringify(serializeError(err))}`);
    throw new Error(`Task Runner => ${workerName} => Error => ${JSON.stringify(serializeError(err))}`);
}

// Run Task Worker
taskRunner(argWorkerName, argFile);