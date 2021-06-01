#!/usr/bin/env node
/// <reference path="../../types/globals.omnihive.d.ts" />

import yargs from "yargs";
import { TaskRunnerService } from "./services/TaskRunnerService";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { CommandLineArgs } from "./models/CommandLineArgs";
import { StringHelper } from "@withonevision/omnihive-core/helpers/StringHelper";
import exitHook from "exit-hook";
import { v4 as uuidv4 } from "uuid";
import ipc from "node-ipc";
import forever from "forever-monitor";

// Setup IPC

let ipcId: string = uuidv4();
ipc.config.id = ipcId;
ipc.config.retry = 1500;
ipc.config.sync = true;

// Setup Child Process
let child: forever.Monitor;

// Get running directory
const runningDir: string = __dirname;

const init = async () => {
    // Interpret command line
    const cmdLineArgs = yargs(process.argv.slice(2));

    cmdLineArgs
        .help(false)
        .version(false)
        .strict()
        .command(["*", "server"], "Server Runner", (args) => {
            return args.option("environmentFile", {
                alias: "ef",
                type: "string",
                demandOption: false,
                description: "Path to environment file (absolute and relative will be checked)",
            });
        })
        .command("taskRunner", "Command-Line Task Runner", (args) => {
            return args
                .option("environmentFile", {
                    alias: "ef",
                    type: "string",
                    description: "Path to environment file (absolute and relative will be checked)",
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
                    demandOption: false,
                    description: "Full path to JSON args file",
                });
        });

    const args = await cmdLineArgs.argv;
    const commandLineArgs: CommandLineArgs = {
        environmentFile: (args.environmentFile as string) ?? "",
        ipcServerId: ipcId,
        taskRunnerWorker: (args.worker as string) ?? "",
        taskRunnerArgs: (args.args as string) ?? "",
    };

    // Check for task runner
    if (args._[0] === "taskRunner") {
        const taskRunnerService: TaskRunnerService = new TaskRunnerService();
        return await AwaitHelper.execute(taskRunnerService.run(runningDir, commandLineArgs));
    }

    // Server is necessary because it's not the taskRunner
    // Serve up IPC
    ipc.serve(() => {
        ipc.server.on("omnihive.reboot", () => {
            child.restart();
        });
    });

    ipc.server.start();

    // Create child process
    createServerChild(commandLineArgs);

    // Process termination (mostly from nodemon)
    process.on("SIGUSR2", () => {
        if (child) {
            child.kill(true);
        }
        process.kill(process.pid, "SIGHUP");
    });
};

// Child process spawner
const createServerChild = async (commandLineArgs: CommandLineArgs) => {
    child = new forever.Monitor(
        [
            `${process.env.NODE_ENV === "production" ? `node` : `ts-node`}`,
            `serverRunner.${process.env.NODE_ENV === "production" ? `js` : `ts`}`,
            `${ipcId}`,
            `${
                !StringHelper.isNullOrWhiteSpace(commandLineArgs.environmentFile)
                    ? `${commandLineArgs.environmentFile}`
                    : ``
            }`,
        ],
        { cwd: runningDir, env: { ...process.env, FORCE_COLOR: "1" } }
    );

    child.on("exit:code", (code: number) => {
        if (!child || code === null) {
            return;
        }

        child.kill(true);
        process.exit(code);
    });

    child.start();
};

// Kill child if parent dies
exitHook(() => {
    if (child) {
        child.kill(true);
    }
});

// Run init
init();
