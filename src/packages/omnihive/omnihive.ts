#!/usr/bin/env node

import { ObjectHelper } from "@withonevision/omnihive-core/helpers/ObjectHelper";
import { ServerSettings } from "@withonevision/omnihive-core/models/ServerSettings";
import chalk from "chalk";
import dotenv from "dotenv";
import figlet from "figlet";
import fse from "fs-extra";
import inquirer from "inquirer";
import yargs from "yargs";
import { ServerService } from "./services/ServerService";
import { TaskRunnerService } from "./services/TaskRunnerService";
import crypto from "crypto";

const init = async () => {
    if (!process.env.omnihive_settings) {
        dotenv.config();
    }

    const args = yargs(process.argv.slice(2));

    args
        .help(false)
        .version(false)
        .strict()
        .command(["*", "server"], "Server Runner", (args) => {
            return args
                .option("settings", {
                    alias: "s",
                    type: "string",
                    demandOption: false,
                    description: "Full path to settings file",
                })
                .option("adminPort", {
                    alias: "ap",
                    type: "number",
                    demandOption: false,
                    default: 7205,
                    description: "Admin port number (default is 7205)",
                })
                .option("webPort", {
                    alias: "wp",
                    type: "number",
                    demandOption: false,
                    default: 3001,
                    description: "Web port number (default is 3001)",
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
        })
        .command("init", "Init a new instance of OmniHive").argv;

    clear();
    console.log(chalk.yellow(figlet.textSync("OMNIHIVE")));
    console.log();

    let finalSettings: string | undefined = undefined;

    if (args.argv._[0] === "init") {
        console.log(chalk.yellow("Let's get an instance set up and running for you!"));
        console.log();
        const answers = await inquirer.prompt([
            {
                type: "input",
                name: "path",
                message: "Where do you want to save the setting file?",
                default: `${process.cwd()}/omnihive_settings.json`,
                validate: (value) => {
                    try {
                        const path: string = `${value as string}`;
                        const exists: boolean = fse.existsSync(path);

                        if (!exists) {
                            return true;
                        }

                        return "This file path already exists.  Please choose a different file path.";
                    } catch {
                        return "This answer generated an unknown error.  Please try again.";
                    }
                },
            },
            {
                type: "number",
                name: "webPort",
                message: "What port number do you want for the web server (default 3001)?",
                default: 3001,
            },
            {
                type: "number",
                name: "adminPort",
                message: "What port number do you want for the admin server (default 7205)?",
                default: 7205,
            },
            {
                type: "input",
                name: "rootUrl",
                message: "What is your root URL with the port (default http://localhost:3001)?",
                default: "http://localhost:3001",
                validate: (value) => {
                    try {
                        const url = new URL(value);

                        if (url) {
                            return true;
                        } else {
                            return "This URL is not valid.  Try a different URL.";
                        }
                    } catch {
                        return "This URL is not valid.  Try a different URL.";
                    }
                },
            },
        ]);

        const settings: ServerSettings = ObjectHelper.createStrict<ServerSettings>(
            ServerSettings,
            JSON.parse(fse.readFileSync(`${process.cwd()}/templates/default_config.json`, { encoding: "utf8" }))
        );

        settings.config.adminPassword = crypto.randomBytes(32).toString("hex");
        settings.config.serverGroupName = crypto.randomBytes(32).toString("hex");

        settings.constants.ohEncryptionKey = crypto.randomBytes(16).toString("hex");
        settings.constants.ohTokenAudience = crypto.randomBytes(32).toString("hex");
        settings.constants.ohTokenSecret = crypto.randomBytes(32).toString("hex");

        settings.config.adminPortNumber = answers.adminPort as number;
        settings.config.webPortNumber = answers.webPort as number;

        fse.writeFileSync(answers.path as string, JSON.stringify(settings));

        console.log(chalk.green("OmniHive Server init complete!  Booting the server now..."));
        console.log();

        finalSettings = answers.path;
    } else {
        if (!args.argv.settings) {
            finalSettings = args.argv.settings as string;
        }
    }

    if (!finalSettings && !process.env.omnihive_settings) {
        console.log(chalk.red("Cannot find any valid settings.  Please provide env file or -s"));
        process.exit();
    }

    let serverSettings: ServerSettings;

    if (finalSettings) {
        serverSettings = ObjectHelper.createStrict<ServerSettings>(
            ServerSettings,
            JSON.parse(fse.readFileSync(finalSettings as string, { encoding: "utf8" }))
        );
    } else {
        serverSettings = ObjectHelper.createStrict<ServerSettings>(
            ServerSettings,
            JSON.parse(fse.readFileSync(process.env.omnihive_settings as string, { encoding: "utf8" }))
        );
    }

    if (args.argv.webPort) {
        serverSettings.config.webPortNumber = args.argv.webPort as number;
    }

    if (args.argv.adminPort) {
        serverSettings.config.adminPortNumber = args.argv.adminPort as number;
    }

    switch (args.argv._[0]) {
        case "init":
        case "server":
            if (args.argv._[0] === "init") {
                console.log(
                    chalk.yellow(`New Server Starting => Admin Password: ${serverSettings.config.adminPassword}`)
                );
                console.log();
            }
            const serverService: ServerService = new ServerService();
            await serverService.run(serverSettings);
            break;
        case "taskRunner":
            const taskRunnerService: TaskRunnerService = new TaskRunnerService();
            await taskRunnerService.run(serverSettings, args.argv.worker as string, args.argv.args as string);
            console.log(chalk.greenBright("Done with task runner..."));
            process.exit();
    }
};

const clear = () => {
    process.stdout.write("\x1b[2J");
    process.stdout.write("\x1b[0f");
};

init();
