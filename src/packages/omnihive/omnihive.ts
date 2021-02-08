#!/usr/bin/env node

import { ObjectHelper } from "@withonevision/omnihive-core/helpers/ObjectHelper";
import { ServerSettings } from "@withonevision/omnihive-core/models/ServerSettings";
import chalk from "chalk";
import dotenv from "dotenv";
import figlet from "figlet";
import fse from "fs-extra";
import yargs from "yargs";
import { ServerService } from "./services/ServerService";
import { TaskRunnerService } from "./services/TaskRunnerService";

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

    if (args.argv.webPort) {
        serverSettings.config.webPortNumber = args.argv.webPort as number;
    }

    if (args.argv.adminPort) {
        serverSettings.config.adminPortNumber = args.argv.adminPort as number;
    }

    switch (args.argv._[0]) {
        case "server":
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
