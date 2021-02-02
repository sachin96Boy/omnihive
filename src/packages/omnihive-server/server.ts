import { NodeServiceFactory } from "@withonevision/omnihive-core-node/factories/NodeServiceFactory";
import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { OmniHiveLogLevel } from "@withonevision/omnihive-core/enums/OmniHiveLogLevel";
import { ServerStatus } from "@withonevision/omnihive-core/enums/ServerStatus";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { ILogWorker } from "@withonevision/omnihive-core/interfaces/ILogWorker";
import { IPubSubClientWorker } from "@withonevision/omnihive-core/interfaces/IPubSubClientWorker";
import { IPubSubServerWorker } from "@withonevision/omnihive-core/interfaces/IPubSubServerWorker";
import { RegisteredInstance } from "@withonevision/omnihive-core/models/RegisteredInstance";
import { ServerSettings } from "@withonevision/omnihive-core/models/ServerSettings";
import chalk from "chalk";
import figlet from "figlet";
import readPkgUp from "read-pkg-up";
import { serializeError } from "serialize-error";
import yargs from "yargs";
import os from "os";

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
        .epilogue("Specifying -n loads the given instance name.  Specifying -s loads the given settings file.")
        .check((args) => {
            if (!args.name && !args.settings) {
                if (!process.env.omnihive_settings) {
                    throw new Error(
                        "You must specify -n or -s to load a settings file or have an env variable of omnihive_settings.  Use -n for a saved instance or -s to load a settings file directly."
                    );
                } else {
                    args.settings = process.env.omnihive_settings as string;
                }
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

    if (!args.argv.settings && !args.argv.name) {
        run(undefined, undefined);
    }

    if (args.argv.settings) {
        run(undefined, args.argv.settings as string);
    }

    if (args.argv.name) {
        run(args.argv.name as string, undefined);
    }
};

const clear = () => {
    process.stdout.write("\x1b[2J");
    process.stdout.write("\x1b[0f");
};

const run = async (name: string | undefined, settings: string | undefined): Promise<void> => {
    if (name && settings) {
        throw new Error(
            "You cannot start the server with a named instance and a settings location.  You must choose one or the other."
        );
    }

    // Check for last run instance

    if (!name && !settings) {
        if (process.env.omnihive_settings) {
            settings = process.env.omnihive_settings as string;
        } else {
            const latestInstance: RegisteredInstance | undefined = NodeServiceFactory.instanceService.getLastRun();

            if (!latestInstance) {
                throw new Error(
                    "No name and no settings given...no environment variables found...and also cannot find latest instance"
                );
            }

            name = latestInstance.name;
        }
    }

    // Check last run name
    if (name) {
        const instance: RegisteredInstance | undefined = NodeServiceFactory.instanceService.get(name);

        if (instance) {
            NodeServiceFactory.instanceService.setLastRun(name);
        } else {
            throw new Error("Instance name provided has not been set or does not exist");
        }
    }

    // Run basic app service
    const instanceSettings: ServerSettings = NodeServiceFactory.instanceService.getInstanceSettings(name, settings);
    const pkgJson: readPkgUp.NormalizedReadResult | undefined = await readPkgUp();
    await NodeServiceFactory.serverService.initCore(pkgJson, instanceSettings);

    // Intialize "backbone" hive workers

    const logWorker: ILogWorker | undefined = await NodeServiceFactory.workerService.getWorker<ILogWorker>(
        HiveWorkerType.Log,
        "ohreqLogWorker"
    );

    if (!logWorker) {
        throw new Error("Core Log Worker Not Found.  Server needs the core log worker ohreqLogWorker");
    }

    const adminPubSubServerWorkerName: string | undefined =
        NodeServiceFactory.configurationService.settings.constants["adminPubSubServerWorkerInstance"];

    const adminPubSubServer: IPubSubServerWorker | undefined = await AwaitHelper.execute<
        IPubSubServerWorker | undefined
    >(
        NodeServiceFactory.workerService.getWorker<IPubSubServerWorker>(
            HiveWorkerType.PubSubServer,
            adminPubSubServerWorkerName
        )
    );

    const adminPubSubClientWorkerName: string | undefined =
        NodeServiceFactory.configurationService.settings.constants["adminPubSubClientWorkerInstance"];

    const adminPubSubClient: IPubSubClientWorker | undefined = await AwaitHelper.execute<
        IPubSubClientWorker | undefined
    >(
        NodeServiceFactory.workerService.getWorker<IPubSubClientWorker>(
            HiveWorkerType.PubSubClient,
            adminPubSubClientWorkerName
        )
    );

    adminPubSubClient?.joinChannel(NodeServiceFactory.configurationService.settings.config.serverGroupName);

    adminPubSubClient?.addListener(
        NodeServiceFactory.configurationService.settings.config.serverGroupName,
        "server-reset-request",
        (data: { reset: boolean }) => {
            if (!data || !data.reset) {
                return;
            }

            NodeServiceFactory.serverService.loadSpecialStatusApp(ServerStatus.Rebuilding).then(() => {
                NodeServiceFactory.serverService.serverChangeHandler();

                try {
                    this.buildServer()
                        .then(() => {
                            NodeServiceFactory.serverService.serverChangeHandler();

                            logWorker.write(OmniHiveLogLevel.Info, `Server Spin-Up Complete => Online `);
                            adminPubSubServer?.emit(
                                NodeServiceFactory.configurationService.settings.config.serverGroupName,
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
                                NodeServiceFactory.configurationService.settings.config.serverGroupName,
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
                        NodeServiceFactory.configurationService.settings.config.serverGroupName,
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
    NodeServiceFactory.serverService.serverChangeHandler();

    // Try to spin up full server
    try {
        await AwaitHelper.execute<void>(this.buildServer());
        NodeServiceFactory.serverService.serverStatus = ServerStatus.Online;
        NodeServiceFactory.serverService.serverChangeHandler();
    } catch (err) {
        // Problem...spin up admin server
        NodeServiceFactory.serverService.loadSpecialStatusApp(ServerStatus.Admin, err);
        NodeServiceFactory.serverService.serverChangeHandler();
        logWorker.write(OmniHiveLogLevel.Error, `Server Spin-Up Error => ${JSON.stringify(serializeError(err))}`);
    }
};

init();
