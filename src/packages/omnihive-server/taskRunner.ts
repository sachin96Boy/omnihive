import { NodeServiceFactory } from "@withonevision/omnihive-core-node/factories/NodeServiceFactory";
import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { OmniHiveLogLevel } from "@withonevision/omnihive-core/enums/OmniHiveLogLevel";
import { StringHelper } from "@withonevision/omnihive-core/helpers/StringHelper";
import { IFileSystemWorker } from "@withonevision/omnihive-core/interfaces/IFileSystemWorker";
import { ILogWorker } from "@withonevision/omnihive-core/interfaces/ILogWorker";
import { HiveWorker } from "@withonevision/omnihive-core/models/HiveWorker";
import { ServerSettings } from "@withonevision/omnihive-core/models/ServerSettings";
import chalk from "chalk";
import figlet from "figlet";
import readPkgUp from "read-pkg-up";
import { serializeError } from "serialize-error";
import yargs from "yargs";

const init = async () => {
    const args = yargs(process.argv.slice(2));

    args
        .help(false)
        .version(false)
        .strict()
        .option("name", {
            alias: "n",
            type: "string",
            demandOption: false,
            description: "Name of the instance you wish to launch",
        })
        .option("settings", {
            alias: "s",
            type: "string",
            demandOption: false,
            description: "Full path to settings file",
        })
        .option("worker", {
            alias: "w",
            type: "string",
            demandOption: true,
            description: "Registered worker to invoke",
        })
        .option("args", {
            alias: "a",
            type: "string",
            demandOption: true,
            description: "Full path to JSON args file",
        })
        .epilogue("Specifying -n loads the given instance name.  Specifying -s loads the given settings file.")
        .check((args) => {
            if (!args.settings && !args.instance) {
                throw new Error("You must specify -n or -s to load a settings file");
            }

            if (args.name && args.settings) {
                throw new Error(
                    "You cannot specify both -n and -s.  Either load a settings file, load an instance name, or manage the instances through the command line"
                );
            }

            return true;
        }).argv;

    clear();
    console.log(chalk.yellow(figlet.textSync("OMNIHIVE")));
    console.log();

    if (args.argv.settings) {
        await run(undefined, args.argv.settings as string, args.argv.worker as string, args.argv.args as string);
    }

    if (args.argv.name) {
        await run(args.argv.name as string, undefined, args.argv.worker as string, args.argv.args as string);
    }

    console.log(chalk.greenBright("Done with task runner..."));
    process.exit();
};

const clear = () => {
    process.stdout.write("\x1b[2J");
    process.stdout.write("\x1b[0f");
};

const logError = async (workerName: string, err: Error) => {
    const logWorker: ILogWorker | undefined = await NodeServiceFactory.workerService.getWorker<ILogWorker>(
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

const run = async (
    name: string | undefined,
    settings: string | undefined,
    worker: string,
    args: string
): Promise<void> => {
    // Run basic app service

    const appSettings: ServerSettings = NodeServiceFactory.instanceService.getInstanceSettings(name, settings);
    const pkgJson: readPkgUp.NormalizedReadResult | undefined = await readPkgUp();
    await NodeServiceFactory.serverService.initCore(pkgJson, appSettings);

    const fileSystemWorker:
        | IFileSystemWorker
        | undefined = await NodeServiceFactory.workerService.getWorker<IFileSystemWorker>(HiveWorkerType.FileSystem);

    if (!fileSystemWorker && args && !StringHelper.isNullOrWhiteSpace(args)) {
        throw new Error("FileSystem Worker Not Found...Cannot Read Args");
    }

    const logWorker: ILogWorker | undefined = await NodeServiceFactory.workerService.getWorker<ILogWorker>(
        HiveWorkerType.Log,
        "ohreqLogWorker"
    );

    if (!logWorker) {
        throw new Error("Core Log Worker Not Found.  Task Runner needs the core log worker ohreqLogWorker");
    }

    // Get TaskWorker

    const taskWorker: [HiveWorker, any] | undefined = NodeServiceFactory.workerService.registeredWorkers.find(
        (w: [HiveWorker, any]) =>
            w[0].name === worker && w[0].enabled === true && w[0].type === HiveWorkerType.TaskFunction
    );

    if (!taskWorker) {
        logError(
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
            logError(worker, err);
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
        logError(worker, err);
    }
};

init();
