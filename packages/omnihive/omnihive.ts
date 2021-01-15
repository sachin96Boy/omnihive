#!/usr/bin/env node

import { AwaitHelper } from "@withonevision/omnihive-common/helpers/AwaitHelper";
import { ObjectHelper } from "@withonevision/omnihive-common/helpers/ObjectHelper";
import { StringBuilder } from "@withonevision/omnihive-common/helpers/StringBuilder";
import { ServerSettings } from "@withonevision/omnihive-common/models/ServerSettings";
import chalk from "chalk";
import Conf from "conf";
import figlet from "figlet";
import fse from "fs-extra";
import readPkgUp, { NormalizedReadResult } from "read-pkg-up";
import yargs from 'yargs';
import { AppService } from "./services/AppService";
import { InstanceService } from "./services/InstanceService";
import { ServerService } from "./services/ServerService";
import { TaskRunnerService } from "./services/TaskRunnerService";

// Set up args and variables

const config = new Conf({ configName: "omnihive", projectName: "omnihive" });

const init = async () => {

    const packageJson: NormalizedReadResult | undefined = await AwaitHelper.execute<NormalizedReadResult | undefined>(readPkgUp());

    if (!packageJson) {
        throw new Error("Package.json must be given to load packages");
    }

    const args = yargs(process.argv.slice(2));

    args
        .help(false)
        .version(false)
        .strict()
        .usage(usage.root())
        .command("instance", "List exsting instance configurations", (args) => {
            return args
                .option("list",
                    {
                        alias: "l",
                        type: "boolean",
                        demandCommand: false,
                        description: "Get a list of registered instances"
                    }
                )
                .option("add",
                    {
                        alias: "a",
                        type: "boolean",
                        demandCommand: false,
                        description: "Add a new instance"
                    }
                )
                .option("edit",
                    {
                        alias: "e",
                        type: "boolean",
                        demandCommand: false,
                        description: "Edit an existing instance"
                    }
                )
                .option("remove",
                    {
                        alias: "r",
                        type: "boolean",
                        demandCommand: false,
                        description: "Remove an existing instance"
                    }
                )
                .option("instance",
                    {
                        alias: "i",
                        type: "string",
                        demandOption: false,
                        description: "Name of the instance you wish to launch"
                    }
                )
                .option("settingsFile",
                    {
                        alias: "s",
                        type: "string",
                        demandOption: false,
                        description: "Full path to settings file"
                    }
                )
                .usage(usage.instance())
                .epilogue("If you specify -a, -u, or -d, you must specify -i.  If you specify -u, you also must specify both -i and -s.")
                .check(async (args) => {
                    await checks.instance(args);
                });
        })
        .command("server", "Run the OmniHive Server", (args) => {
            return args
                .option("instance",
                    {
                        alias: "i",
                        type: "string",
                        demandOption: false,
                        description: "Name of the instance you wish to launch"
                    }
                )
                .option("settingsFile",
                    {
                        alias: "s",
                        type: "string",
                        demandOption: false,
                        description: "Full path to settings file"
                    }
                )
                .usage(usage.server())
                .epilogue("Specifying -i loads the given instance.  Specifying -s loads the given settings file.")
                .check((args) => {
                    if (!args.settingsFile && !args.instance) {
                        throw new Error("You must specify -i or -s to load a settings file")
                    }

                    if (args.settingsFile && args.instance) {
                        throw new Error("You cannot specify both an instance and a settings file.  Either load a settings file, load an instance, or manage the instances through the command line");
                    }

                    return true;
                })
        }, (handler) => {
            if (handler.settingsFile && !handler.instance) {
                const settingsOnly = JSON.parse(fse.readFileSync(handler.settingsFile, { encoding: "utf8" }));

                try {
                    ObjectHelper.createStrict<ServerSettings>(ServerSettings, settingsOnly);
                } catch {
                    throw new Error("Settings file path cannot be parsed into a valid server settings model");
                }
            }

            if (handler.instance && !handler.settingsFile) {
                try {
                    const instanceFile: string = config.get(handler.instance as string) as string;

                    if (!instanceFile) {
                        throw new Error("Instance cannot be found");
                    }

                    ObjectHelper.createStrict<ServerSettings>(ServerSettings, instanceFile);
                } catch {
                    throw new Error("Instance file cannot be parsed into a valid server settings model");
                }
            }
        })
        .command("taskRunner", "Run a Specific Task Runner", (args) => {
            return args
                .option("instance",
                    {
                        alias: "i",
                        type: "string",
                        demandOption: false,
                        description: "Name of the instance you wish to launch"
                    }
                )
                .option("settingsFile",
                    {
                        alias: "s",
                        type: "string",
                        demandOption: false,
                        description: "Full path to settings file"
                    }
                )
                .option("workerName",
                    {
                        alias: "w",
                        type: "string",
                        demandOption: true,
                        description: "Registered worker to invoke"
                    }
                )
                .option("argsFile",
                    {
                        alias: "a",
                        type: "string",
                        demandOption: true,
                        description: "Full path to JSON args file"
                    }
                )
                .usage(usage.taskRunner())
                .epilogue("Specifying -i loads the given instance.  Specifying -s loads the given settings file.")
                .check((args) => {
                    if (!args.settingsFile && !args.instance) {
                        throw new Error("You must specify -i or -s to load a settings file")
                    }

                    if (args.settingsFile && args.instance) {
                        throw new Error("You cannot specify both an instance and a settings file.  Either load a settings file, load an instance, or manage the instances through the command line");
                    }

                    return true;
                });
        }, (handler) => {
            if (handler.settingsFile && !handler.instance) {
                const settingsOnly = JSON.parse(fse.readFileSync(handler.settingsFile, { encoding: "utf8" }));

                try {
                    ObjectHelper.createStrict<ServerSettings>(ServerSettings, settingsOnly);
                } catch {
                    throw new Error("Settings file path cannot be parsed into a valid server settings model");
                }
            }

            if (handler.instance && !handler.settingsFile) {
                try {
                    const instanceFile: string = config.get(handler.instance as string) as string;

                    if (!instanceFile) {
                        throw new Error("Instance cannot be found");
                    }

                    ObjectHelper.createStrict<ServerSettings>(ServerSettings, instanceFile);
                } catch {
                    throw new Error("Instance file cannot be parsed into a valid server settings model");
                }
            }
        }).argv;

    switch (args.argv._[0]) {
        case "instance":
            const instanceService: InstanceService = new InstanceService();

            if (args.argv.list) {
                instanceService.list();
                return;
            }

            if (args.argv.add) {
                if (args.argv.settingsFile) {
                    instanceService.add(args.argv.instanceName as string, args.argv.settingsFile as string);
                } else {
                    instanceService.add(args.argv.instanceName as string, undefined);
                }

                return;
            }

            if (args.argv.edit) {
                instanceService.edit(args.argv.instanceName as string, args.argv.settingsFile as string);
                return;
            }

            if (args.argv.remove) {
                instanceService.remove(args.argv.instanceName as string);
            }

            break;
        case "server":
            const serverAppService: AppService = new AppService();
            const serverService: ServerService = new ServerService();

            serverAppService.initApp(args.argv.settingsFile as string);
            serverService.start();
            break;
        case "taskRunner":
            const runnerAppService: AppService = new AppService();
            const runnerService: TaskRunnerService = new TaskRunnerService();

            runnerAppService.initApp(args.argv.settingsFile as string);
            runnerService.start(args.argv.workerName as string, args.argv.argsFile as string);
            break;
        default:
            return;
    }
}

const checks = {
    instance: async (_args: yargs.Arguments<{
        list: boolean | undefined;
    } & {
        add: boolean | undefined;
    } & {
        edit: boolean | undefined;
    } & {
        remove: boolean | undefined;
    } & {
        instance: string | undefined;
    } & {
        settingsFile: string | undefined;
    }>): Promise<boolean> => {
        return true;
    }
}

const usage = {
    root: (): string => {
        const builder: StringBuilder = new StringBuilder();

        builder.appendLine();
        builder.appendLine(`${chalk.yellow(figlet.textSync("OMNIHIVE"))}`);
        builder.appendLine(`Usage:`);
        builder.append(`  omnihive <command> <options>`);

        return builder.outputString();
    },
    instance: (): string => {

        const builder: StringBuilder = new StringBuilder();

        builder.appendLine();
        builder.appendLine(`${chalk.yellow(figlet.textSync("OMNIHIVE"))}`);
        builder.appendLine(`Instance Usage:`);
        builder.append(`  omnihive instance <options>`);

        return builder.outputString();
    },
    server: (): string => {
        const builder: StringBuilder = new StringBuilder();

        builder.appendLine();
        builder.appendLine(`${chalk.yellow(figlet.textSync("OMNIHIVE"))}`);
        builder.appendLine(`Server Usage:`);
        builder.append(`  omnihive server <options>`);

        return builder.outputString();
    },
    taskRunner: (): string => {
        const builder: StringBuilder = new StringBuilder();

        builder.appendLine();
        builder.appendLine(`${chalk.yellow(figlet.textSync("OMNIHIVE"))}`);
        builder.appendLine(`Task Runner Usage:`);
        builder.append(`  omnihive taskRunner <options>`);

        return builder.outputString();
    }
}

init();