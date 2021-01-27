#!/usr/bin/env node

import { ObjectHelper } from "@withonevision/omnihive-core/helpers/ObjectHelper";
import { RegisteredInstance } from "@withonevision/omnihive-core/models/RegisteredInstance";
import { ServerSettings } from "@withonevision/omnihive-core/models/ServerSettings";
import chalk from "chalk";
import Table from "cli-table";
import crypto from "crypto";
import figlet from "figlet";
import fs from "fs";
import inquirer from "inquirer";
import yargs from "yargs";
import { InstanceService } from "./services/InstanceService";

const init = async () => {
    const args = yargs(process.argv.slice(2));

    console.clear();
    console.log(chalk.yellow(figlet.textSync("OMNIHIVE")));
    console.log();

    args
        .help(false)
        .version(false)
        .strict()
        .command("init", "Set up new OmniHive Server with walkthrough")
        .command("instance", "List exsting instance configurations", (args) => {
            return args
                .option("list", {
                    alias: "l",
                    type: "boolean",
                    demandCommand: false,
                    description: "Get a list of registered instances",
                })
                .option("add", {
                    alias: "a",
                    type: "boolean",
                    demandCommand: false,
                    description: "Add a new instance",
                })
                .option("edit", {
                    alias: "e",
                    type: "boolean",
                    demandCommand: false,
                    description: "Edit an existing instance",
                })
                .option("remove", {
                    alias: "r",
                    type: "boolean",
                    demandCommand: false,
                    description: "Remove an existing instance",
                })
                .option("name", {
                    alias: "n",
                    type: "string",
                    demandOption: false,
                    description: "Name of the instance you wish to act upon",
                })
                .option("settings", {
                    alias: "s",
                    type: "string",
                    demandOption: false,
                    description: "Full path to settings file",
                })
                .epilogue(
                    "If you specify -a, -e, or -r, you must specify -n.  If you specify -e, you also must specify both -n and -s."
                )
                .check((args) => {
                    if (args.list && (args.add || args.edit || args.settings || args.name || args.remove)) {
                        throw new Error("-l cannot be paired with any other argument");
                    }

                    if (args.add && (!args.name || !args.settings)) {
                        throw new Error(
                            "-a must have both -n and -s to know which instance to edit and what file to use"
                        );
                    }

                    if (args.edit && (!args.name || !args.settings)) {
                        throw new Error(
                            "-e must have both -n and -s to know which instance to edit and what file to use"
                        );
                    }

                    if (args.remove && !args.name) {
                        throw new Error("-r must be paired with -n to know which name to remove");
                    }

                    return true;
                });
        }).argv;

    switch (args.argv._[0]) {
        case "init":
            console.log(chalk.yellow("Let's get an instance set up and running for you!"));
            console.log();
            inquirer
                .prompt([
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

                                return "This instance already exists.  Please choose a different instance name.";
                            } catch {
                                return "This answer generated an unknown error.  Please try again.";
                            }
                        },
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

                                return "This file path already exists.  Please choose a different file path.";
                            } catch {
                                return "This answer generated an unknown error.  Please try again.";
                            }
                        },
                    },
                ])
                .then((answers) => {
                    //const instanceService: InstanceService = new InstanceService();
                    const settings: ServerSettings = ObjectHelper.createStrict<ServerSettings>(
                        ServerSettings,
                        JSON.parse(
                            fs.readFileSync(`${process.cwd()}/templates/default_config.json`, { encoding: "utf8" })
                        )
                    );

                    const filePath: string = `${answers.path as string}/omnihive_${answers.name as string}.json`;

                    settings.config.adminPassword = crypto.randomBytes(32).toString("hex");
                    settings.config.serverGroupName = crypto.randomBytes(32).toString("hex");
                    settings.constants.ohEncryptionKey = crypto.randomBytes(32).toString("hex");
                    settings.constants.ohTokenAudience = crypto.randomBytes(32).toString("hex");
                    settings.constants.ohTokenSecret = crypto.randomBytes(32).toString("hex");

                    fs.writeFileSync(filePath as string, JSON.stringify(settings));
                    //instanceService.add(answers.name as string, filePath);

                    console.log(chalk.green("OmniHive Server init complete!  Booting the server now..."));
                    console.log();
                });
            break;
        case "instance":
            const instanceService: InstanceService = new InstanceService();

            if (args.argv.list) {
                const instances: RegisteredInstance[] = instanceService.getAll();

                console.log(chalk.yellow("Getting OmniHive Instances..."));

                const table = new Table({
                    head: ["Name", "Settings Location"],
                    colWidths: [20, 80],
                });

                if (instances.length === 0) {
                    console.log(chalk.yellow("There are no registered OmniHive instances"));

                    table.push(["", ""]);
                } else {
                    console.log(chalk.yellow("OmniHive Registered Instances"));

                    instances.forEach((instance: RegisteredInstance) => {
                        table.push([instance.name, instance.settingsLocation]);
                    });
                }

                console.log(table.toString());
                return;
            }

            if (args.argv.add) {
                console.log(chalk.yellow("Adding OmniHive Instance..."));

                //const add: boolean = instanceService.add(args.argv.name as string, args.argv.settings as string);

                /*
                if (add) {
                    console.log(chalk.green(`OmniHive instance ${args.argv.name as string} successfully added`));
                } else {
                    console.log(
                        chalk.red(
                            `OmniHive instance ${
                                args.argv.name as string
                            } already exists or could not be edited with the given settings file`
                        )
                    );
                }
                */

                return;
            }

            if (args.argv.edit) {
                console.log(chalk.yellow("Editing OmniHive Instance..."));

                //const edit: boolean = instanceService.edit(args.argv.name as string, args.argv.settings as string);

                /*
                if (edit) {
                    console.log(chalk.green(`OmniHive instance ${args.argv.name as string} successfully edited`));
                } else {
                    console.log(
                        chalk.red(
                            `OmniHive instance ${
                                args.argv.name as string
                            } could not be edited with the given settings file`
                        )
                    );
                }
                */

                return;
            }

            if (args.argv.remove) {
                console.log(chalk.yellow("Removing OmniHive Instance..."));

                const remove: boolean = instanceService.remove(args.argv.name as string);

                if (remove) {
                    console.log(chalk.green(`OmniHive instance ${args.argv.name as string} successfully removed`));
                } else {
                    console.log(
                        chalk.red(`OmniHive instance ${args.argv.name as string} not found in registered instances`)
                    );
                }
            }

            break;
        default:
            return;
    }
};

init();
