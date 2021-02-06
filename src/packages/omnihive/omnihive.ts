#!/usr/bin/env node

import { ObjectHelper } from "@withonevision/omnihive-core/helpers/ObjectHelper";
import { ServerSettings } from "@withonevision/omnihive-core/models/ServerSettings";
import chalk from "chalk";
import yargs from "yargs";
import fse from "fs-extra";
import figlet from "figlet";
import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { OmniHiveLogLevel } from "@withonevision/omnihive-core/enums/OmniHiveLogLevel";
import { CoreServiceFactory } from "@withonevision/omnihive-core/factories/CoreServiceFactory";
import { ILogWorker } from "@withonevision/omnihive-core/interfaces/ILogWorker";
import { serializeError } from "serialize-error";
import readPkgUp from "read-pkg-up";
import { NodeServiceFactory } from "@withonevision/omnihive-core-node/factories/NodeServiceFactory";
import { StringHelper } from "@withonevision/omnihive-core/helpers/StringHelper";
import { IFileSystemWorker } from "@withonevision/omnihive-core/interfaces/IFileSystemWorker";
import { HiveWorker } from "@withonevision/omnihive-core/models/HiveWorker";
import { ServerStatus } from "@withonevision/omnihive-core/enums/ServerStatus";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { IPubSubClientWorker } from "@withonevision/omnihive-core/interfaces/IPubSubClientWorker";
import { IPubSubServerWorker } from "@withonevision/omnihive-core/interfaces/IPubSubServerWorker";
import { IServerWorker } from "@withonevision/omnihive-core/interfaces/IServerWorker";
import os from "os";
import dotenv from "dotenv";

const init = async () => {
    if (!process.env.omnihive_settings) {
        dotenv.config();
    }

    const args = yargs(process.argv.slice(2));

    args
        .help(false)
        .version(false)
        .strict()
        .command("server", "Server Runner", (args) => {
            return args
                .option("settings", {
                    alias: "s",
                    type: "string",
                    demandOption: false,
                    description: "Full path to settings file",
                })
                .check((args) => {
                    if (args.settings) {
                        try {
                            ObjectHelper.createStrict<ServerSettings>(
                                ServerSettings,
                                JSON.parse(fse.readFileSync(args.settings, { encoding: "utf8" }))
                            );
                            return true;
                        } catch {
                            return false;
                        }
                    }

                    return true;
                });
        })
        .command("taskRunner", "Command-Line Task Runner", (args) => {
            return args
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
                .check((args) => {
                    if (args.settings) {
                        try {
                            ObjectHelper.createStrict<ServerSettings>(
                                ServerSettings,
                                JSON.parse(fse.readFileSync(args.settings, { encoding: "utf8" }))
                            );
                            return true;
                        } catch {
                            return false;
                        }
                    }

                    return true;
                });
        }).argv;

    clear();
    console.log(chalk.yellow(figlet.textSync("OMNIHIVE")));
    console.log();

    if (!args.argv.settings && !process.env.omnihive_settings) {
        console.log(chalk.red("Cannot find any valid settings.  Please provide env file or -s"));
        process.exit();
    }

    let serverSettings: ServerSettings;

    if (args.argv.settings) {
        serverSettings = ObjectHelper.createStrict<ServerSettings>(
            ServerSettings,
            JSON.parse(fse.readFileSync(args.argv.settings as string, { encoding: "utf8" }))
        );
    } else {
        serverSettings = ObjectHelper.createStrict<ServerSettings>(
            ServerSettings,
            JSON.parse(fse.readFileSync(process.env.omnihive_settings as string, { encoding: "utf8" }))
        );
    }

    switch (args.argv._[0]) {
        case "server":
            await server(serverSettings);
            break;
        case "taskRunner":
            await taskRunner(serverSettings, args.argv.worker as string, args.argv.args as string);
            console.log(chalk.greenBright("Done with task runner..."));
            process.exit();
    }
};

const server = async (settings: ServerSettings): Promise<void> => {
    const pkgJson: readPkgUp.NormalizedReadResult | undefined = await readPkgUp();
    await NodeServiceFactory.serverService.initCore(pkgJson, settings);

    // Check server worker
    const serverWorker: IServerWorker | undefined = await CoreServiceFactory.workerService.getWorker<IServerWorker>(
        HiveWorkerType.Server
    );

    if (!serverWorker) {
        throw new Error("No server worker has been registered");
    }

    // Intialize "backbone" hive workers

    const logWorker: ILogWorker | undefined = await CoreServiceFactory.workerService.getWorker<ILogWorker>(
        HiveWorkerType.Log,
        "ohreqLogWorker"
    );

    if (!logWorker) {
        throw new Error("Core Log Worker Not Found.  Server needs the core log worker ohreqLogWorker");
    }

    const adminPubSubServerWorkerName: string | undefined =
        CoreServiceFactory.configurationService.settings.constants["adminPubSubServerWorkerInstance"];

    const adminPubSubServer: IPubSubServerWorker | undefined = await AwaitHelper.execute<
        IPubSubServerWorker | undefined
    >(
        CoreServiceFactory.workerService.getWorker<IPubSubServerWorker>(
            HiveWorkerType.PubSubServer,
            adminPubSubServerWorkerName
        )
    );

    const adminPubSubClientWorkerName: string | undefined =
        CoreServiceFactory.configurationService.settings.constants["adminPubSubClientWorkerInstance"];

    const adminPubSubClient: IPubSubClientWorker | undefined = await AwaitHelper.execute<
        IPubSubClientWorker | undefined
    >(
        CoreServiceFactory.workerService.getWorker<IPubSubClientWorker>(
            HiveWorkerType.PubSubClient,
            adminPubSubClientWorkerName
        )
    );

    adminPubSubClient?.joinChannel(CoreServiceFactory.configurationService.settings.config.serverGroupName);

    adminPubSubClient?.addListener(
        CoreServiceFactory.configurationService.settings.config.serverGroupName,
        "server-reset-request",
        (data: { reset: boolean }) => {
            if (!data || !data.reset) {
                return;
            }

            NodeServiceFactory.serverService.loadSpecialStatusApp(ServerStatus.Rebuilding).then(() => {
                NodeServiceFactory.serverService.serverChangeHandler();

                try {
                    serverWorker
                        .buildServer()
                        .then(() => {
                            NodeServiceFactory.serverService.serverChangeHandler();

                            logWorker.write(OmniHiveLogLevel.Info, `Server Spin-Up Complete => Online `);
                            adminPubSubServer?.emit(
                                CoreServiceFactory.configurationService.settings.config.serverGroupName,
                                "server-reset-result",
                                {
                                    serverName: os.hostname(),
                                    success: true,
                                    error: "",
                                }
                            );
                        })
                        .catch((err: Error) => {
                            NodeServiceFactory.serverService.loadSpecialStatusApp(ServerStatus.Admin, err);
                            NodeServiceFactory.serverService.serverChangeHandler();

                            logWorker.write(
                                OmniHiveLogLevel.Error,
                                `Server Spin-Up Error => ${JSON.stringify(serializeError(err))}`
                            );
                            adminPubSubServer?.emit(
                                CoreServiceFactory.configurationService.settings.config.serverGroupName,
                                "server-reset-result",
                                {
                                    serverName: os.hostname(),
                                    success: false,
                                    error: JSON.stringify(serializeError(err)),
                                }
                            );
                        });
                } catch (err) {
                    NodeServiceFactory.serverService.loadSpecialStatusApp(ServerStatus.Admin, err);
                    NodeServiceFactory.serverService.serverChangeHandler();

                    logWorker.write(
                        OmniHiveLogLevel.Error,
                        `Server Spin-Up Error => ${JSON.stringify(serializeError(err))}`
                    );
                    adminPubSubServer?.emit(
                        CoreServiceFactory.configurationService.settings.config.serverGroupName,
                        "server-reset-result",
                        {
                            serverName: os.hostname(),
                            success: false,
                            error: JSON.stringify(serializeError(err)),
                        }
                    );
                }
            });
        }
    );

    // Set server to rebuilding first
    await AwaitHelper.execute<void>(NodeServiceFactory.serverService.loadSpecialStatusApp(ServerStatus.Rebuilding));
    await NodeServiceFactory.serverService.serverChangeHandler();

    // Try to spin up full server
    try {
        await AwaitHelper.execute<void>(serverWorker.buildServer());
        NodeServiceFactory.serverService.serverStatus = ServerStatus.Online;
        await NodeServiceFactory.serverService.serverChangeHandler();
    } catch (err) {
        // Problem...spin up admin server
        NodeServiceFactory.serverService.loadSpecialStatusApp(ServerStatus.Admin, err);
        await NodeServiceFactory.serverService.serverChangeHandler();
        logWorker.write(OmniHiveLogLevel.Error, `Server Spin-Up Error => ${JSON.stringify(serializeError(err))}`);
    }
};

const taskRunner = async (settings: ServerSettings, worker: string, args: string): Promise<void> => {
    // Run basic app service
    const pkgJson: readPkgUp.NormalizedReadResult | undefined = await readPkgUp();
    await NodeServiceFactory.serverService.initCore(pkgJson, settings);

    const fileSystemWorker:
        | IFileSystemWorker
        | undefined = await CoreServiceFactory.workerService.getWorker<IFileSystemWorker>(HiveWorkerType.FileSystem);

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

const clear = () => {
    process.stdout.write("\x1b[2J");
    process.stdout.write("\x1b[0f");
};

const logError = async (workerName: string, err: Error) => {
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

init();
