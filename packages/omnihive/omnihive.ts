#!/usr/bin/env node

import { ObjectHelper } from "@withonevision/omnihive-common/helpers/ObjectHelper";
import { StringBuilder } from "@withonevision/omnihive-common/helpers/StringBuilder";
import { RegisteredInstance } from "@withonevision/omnihive-common/models/RegisteredInstance";
import { ServerSettings } from "@withonevision/omnihive-common/models/ServerSettings";
import chalk from "chalk";
import Table from "cli-table";
import crypto from "crypto";
import figlet from "figlet";
import fs from "fs";
import inquirer from "inquirer";
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
        .command(["*", "server"], "Run the OmniHive Server", (args) => {
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
                        if (!process.env.omnihive_settings) {
                            throw new Error("You must specify -n or -s to load a settings file.  Use -n for a saved instance or -s to load a settings file directly.");
                        } else {
                            args.settings = process.env.omnihive_settings as string;
                        }
                    }

                    if (args.name && args.settings) {
                        throw new Error("You cannot specify both -n and -s.  Either load a settings file, load an instance name, or manage the instances through the command line");
                    }

                    return true;
                })
        })
        .command("init", "Set up new OmniHive Server with walkthrough")
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
                        description: "Name of the instance you wish to act upon"
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
                .epilogue("If you specify -a, -e, or -r, you must specify -n.  If you specify -e, you also must specify both -n and -s.")
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
        case "*":
        case "server":
            const serverService: ServerService = new ServerService();

            if (!args.argv.settings && !args.argv.name) {
                serverService.start(undefined, undefined);
            }

            if (args.argv.settings) {
                serverService.start(undefined, args.argv.settings as string)
            }

            if (args.argv.name) {
                serverService.start(args.argv.name as string, undefined)
            }

            break;
        case "init":
            console.log(chalk.yellow(figlet.textSync("OMNIHIVE")));
            console.log();
            console.log(chalk.yellow("Let's get an instance set up and running for you!"));
            console.log();
            inquirer.prompt([
                {
                    type: "input",
                    name: "name",
                    message: "What is the name you want to give this instance",
                    validate: (value) => {
                        try {
                            const instanceService: InstanceService = new InstanceService();
                            const exists: RegisteredInstance | undefined = instanceService.get(value as string);

                            if (!exists) {
                                return true;
                            }

                            return "This instance already exists.  Please choose a different instance name."
                        } catch {
                            return "This answer generated an unknown error.  Please try again."
                        }
                    }
                },
                {
                    type: "input",
                    name: "path",
                    message: "Where do you want to save the setting file (full JSON file path)",
                    validate: (value) => {
                        try {
                            const path: string = `${value as string}`;
                            const exists: boolean = fs.existsSync(path);

                            if (!exists) {
                                return true;
                            }

                            return "This file path already exists.  Please choose a different file path."
                        } catch {
                            return "This answer generated an unknown error.  Please try again."
                        }
                    }
                }
            ]).then((answers) => {

                const instanceService: InstanceService = new InstanceService();
                const serverService: ServerService = new ServerService();
                const settings: ServerSettings = ObjectHelper.createStrict<ServerSettings>(ServerSettings, JSON.parse(fs.readFileSync(`${process.cwd()}/templates/default_config.json`, { encoding: "utf8" })));

                const filePath: string = `${answers.path as string}/omnihive_${answers.name as string}.json`;

                settings.config.adminPassword = crypto.randomBytes(32).toString("hex");
                settings.config.serverGroupName = crypto.randomBytes(32).toString("hex");
                settings.constants.ohEncryptionKey = crypto.randomBytes(32).toString("hex");
                settings.constants.ohTokenAudience = crypto.randomBytes(32).toString("hex");
                settings.constants.ohTokenSecret = crypto.randomBytes(32).toString("hex");

                fs.writeFileSync(filePath as string, JSON.stringify(settings));
                instanceService.add(answers.name as string, filePath);

                console.log(chalk.green("OmniHive Server init complete!  Booting the server now..."));
                console.log();

                serverService.start(answers.name, undefined);

            });
            break;
        case "instance":
            const instanceService: InstanceService = new InstanceService();

            console.log(chalk.yellow(figlet.textSync("OMNIHIVE")));

            if (args.argv.list) {
                const instances: RegisteredInstance[] = instanceService.getAll();

                console.log(chalk.yellow("Getting OmniHive Instances..."));

                const table = new Table({
                    head: ['Name', 'Settings Location'],
                    colWidths: [20, 80]
                });

                if (instances.length === 0) {
                    console.log(chalk.yellow("There are no registered OmniHive instances"));

                    table.push(["", ""]);
                } else {
                    console.log(chalk.yellow("OmniHive Registered Instances"));

                    instances.forEach((instance: RegisteredInstance) => {
                        table.push([instance.name, instance.settings]);
                    });
                }

                console.log(table.toString());
                return;
            }

            if (args.argv.add) {
                console.log(chalk.yellow("Adding OmniHive Instance..."));

                const add: boolean = instanceService.add(args.argv.name as string, args.argv.settings as string);

                if (add) {
                    console.log(chalk.green(`OmniHive instance ${args.argv.name as string} successfully added`));
                } else {
                    console.log(chalk.red(`OmniHive instance ${args.argv.name as string} already exists or could not be edited with the given settings file`));
                }

                return;
            }

            if (args.argv.edit) {
                console.log(chalk.yellow("Editing OmniHive Instance..."));

                const edit: boolean = instanceService.edit(args.argv.name as string, args.argv.settings as string);

                if (edit) {
                    console.log(chalk.green(`OmniHive instance ${args.argv.name as string} successfully edited`));
                } else {
                    console.log(chalk.red(`OmniHive instance ${args.argv.name as string} could not be edited with the given settings file`));
                }

                return;
            }

            if (args.argv.remove) {
                console.log(chalk.yellow("Removing OmniHive Instance..."));

                const remove: boolean = instanceService.remove(args.argv.name as string);

                if (remove) {
                    console.log(chalk.green(`OmniHive instance ${args.argv.name as string} successfully removed`));
                } else {
                    console.log(chalk.red(`OmniHive instance ${args.argv.name as string} not found in registered instances`));
                }
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