#!/usr/bin/env node
import { IsHelper } from "@withonevision/omnihive-core";
import yargs from "yargs";
import { CommandLineArgs } from "./models/CommandLineArgs.js";
import { ServerService } from "./services/ServerService.js";
import { URL } from "url";

const run = async () => {
    const serverService = new ServerService();

    const input = await yargs(process.argv.slice(2)).argv;

    const runningDir: string = new URL(".", import.meta.url).pathname;
    const commandLineArgs: CommandLineArgs = new CommandLineArgs();
    commandLineArgs.ipcServerId = input._[0] as string;

    if (!IsHelper.isNullOrUndefined(input._) && input._.length > 1) {
        commandLineArgs.environmentFile = input._[1] as string;
    }

    serverService.run(runningDir, commandLineArgs);
};

run();
