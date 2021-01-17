#!/usr/bin/env node

import { StringBuilder } from "@withonevision/omnihive-common/helpers/StringBuilder";
import { RegisteredInstance } from "@withonevision/omnihive-common/models/RegisteredInstance";
import chalk from "chalk";
import Table from "cli-table";
import figlet from "figlet";
import yargs from 'yargs';
import { InstanceService } from "./services/InstanceService";
import { ServerService } from "./services/ServerService";
import { TaskRunnerService } from "./services/TaskRunnerService";

const init = async () => {

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
                .option("name",
                    {
                        alias: "n",
                        type: "string",
                        demandOption: false,
                        description: "Name of the instance you wish to launch"
                    }
                )
                .option("settings",
                    {
                        alias: "s",
                        type: "string",
                        demandOption: false,
                        description: "Full path to settings file"
                    }
                )
                .usage(usage.instance())
                .epilogue("If you specify -a, -u, or -d, you must specify -n.  If you specify -u, you also must specify both -n and -s.")
                .check((args) => {
                    if (args.list && (args.add || args.edit || args.settings || args.name || args.remove)) {
                        throw new Error("-l cannot be paired with any other argument");
                    }

                    if (args.add && (!args.name || !args.settings)) {
                        throw new Error("-a must have both -n and -s to know which instance to edit and what file to use");
                    }

                    if (args.edit && (!args.name || !args.settings)) {
                        throw new Error("-e must have both -n and -s to know which instance to edit and what file to use");
                    }

                    if (args.remove && !args.name) {
                        throw new Error("-r must be paired with -n to know which name to remove");
                    }

                    return true;
                });
        })
        .command("server", "Run the OmniHive Server", (args) => {
            return args
                .option("name",
                    {
                        alias: "n",
                        type: "string",
                        demandOption: false,
                        description: "Name of the instance you wish to launch"
                    }
                )
                .option("settings",
                    {
                        alias: "s",
                        type: "string",
                        demandOption: false,
                        description: "Full path to settings file"
                    }
                )
                .usage(usage.server())
                .epilogue("Specifying -n loads the given instance name.  Specifying -s loads the given settings file.")
                .check((args) => {
                    if (!args.name && !args.settings) {
                        throw new Error("You must specify -n or -s to load a settings file.  Use -n for a saved instance or -s to load a settings file directly.")
                    }

                    if (args.name && args.settings) {
                        throw new Error("You cannot specify both -n and -s.  Either load a settings file, load an instance name, or manage the instances through the command line");
                    }

                    return true;
                })
        })
        .command("taskRunner", "Run a Specific Task Runner", (args) => {
            return args
                .option("name",
                    {
                        alias: "n",
                        type: "string",
                        demandOption: false,
                        description: "Name of the instance you wish to launch"
                    }
                )
                .option("settings",
                    {
                        alias: "s",
                        type: "string",
                        demandOption: false,
                        description: "Full path to settings file"
                    }
                )
                .option("worker",
                    {
                        alias: "w",
                        type: "string",
                        demandOption: true,
                        description: "Registered worker to invoke"
                    }
                )
                .option("args",
                    {
                        alias: "a",
                        type: "string",
                        demandOption: true,
                        description: "Full path to JSON args file"
                    }
                )
                .usage(usage.taskRunner())
                .epilogue("Specifying -n loads the given instance name.  Specifying -s loads the given settings file.")
                .check((args) => {
                    if (!args.settings && !args.instance) {
                        throw new Error("You must specify -n or -s to load a settings file")
                    }

                    if (args.name && args.settings) {
                        throw new Error("You cannot specify both -n and -s.  Either load a settings file, load an instance name, or manage the instances through the command line");
                    }

                    return true;
                });
        }).argv;

    switch (args.argv._[0]) {
        case "instance":
            const instanceService: InstanceService = new InstanceService();

            if (args.argv.list) {
                const instances: RegisteredInstance[] = instanceService.getAll();

                if (instances.length === 0) {
                    console.log(chalk.yellow("There are no registered OmniHive instances"));
                    return;
                }
        
                const table = new Table({
                    head: ['Name', 'Settings Location'],
                    colWidths: [100, 200]
                });
        
                instances.forEach((instance: RegisteredInstance) => {
                    table.push([instance.name, instance.settings]);
                });
        
                console.log(table.toString());
                return;
            }

            if (args.argv.add) {
                const add: boolean = instanceService.add(args.argv.name as string, args.argv.settings as string);

                if (add) {
                    console.log(chalk.green(`OmniHive instance ${args.argv.name as string} successfully added`));
                } else {
                    console.log(chalk.red(`OmniHive instance ${args.argv.name as string} already exists or could not be edited with the given settings file`));
                }

                return;
            }

            if (args.argv.edit) {
                const edit: boolean = instanceService.edit(args.argv.name as string, args.argv.settings as string);

                if (edit) {
                    console.log(chalk.green(`OmniHive instance ${args.argv.name as string} successfully edited`));
                } else {
                    console.log(chalk.red(`OmniHive instance ${args.argv.name as string} could not be edited with the given settings file`));
                }

                return;
            }

            if (args.argv.remove) {
                const remove: boolean = instanceService.remove(args.argv.name as string);

                if(remove) {
                    console.log(chalk.green(`OmniHive instance ${args.argv.name as string} successfully removed`));
                } else {
                    console.log(chalk.red(`OmniHive instance ${args.argv.name as string} not found in registered instances`));
                }
            }

            break;
        case "server":
            const serverService: ServerService = new ServerService();

            if (args.argv.settings) {
                serverService.start(undefined, args.argv.settings as string)
            }

            if (args.argv.name) {
                serverService.start(args.argv.name as string, undefined)
            }

            break;
        case "taskRunner":
            const runnerService: TaskRunnerService = new TaskRunnerService();

            if (args.argv.settings) {
                runnerService.start(undefined, args.argv.settings as string, args.argv.worker as string, args.argv.args as string);
            }

            if (args.argv.name) {
                runnerService.start(args.argv.name as string, undefined, args.argv.worker as string, args.argv.args as string);
            }

            break;
        default:
            return;
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