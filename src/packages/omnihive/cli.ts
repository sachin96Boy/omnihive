#!/usr/bin/env node

import { NodeServiceFactory } from "@withonevision/omnihive-core-node/factories/NodeServiceFactory";
import { RegisteredInstance } from "@withonevision/omnihive-core/models/RegisteredInstance";
import chalk from "chalk";
import Table from "cli-table";
import figlet from "figlet";
import inquirer from "inquirer";

const init = async () => {
    clearAndPrintBanner();
    console.log();
    console.log(chalk.yellow("Welcome to the OmniHive Manager"));
    console.log();
    await mainMenu();
};

const clearAndPrintBanner = () => {
    clear();
    console.log(chalk.yellow(figlet.textSync("OMNIHIVE")));
};

const mainMenu = async () => {
    const mainAnswer = await inquirer.prompt({
        type: "list",
        name: "mainMenu",
        default: "list",
        message: chalk.yellow("What would you like to do?"),
        choices: [
            { name: "List All Instances", value: "list" },
            { name: "Add an Instance", value: "add" },
            { name: "Edit an Instance", value: "edit" },
            { name: "Remove an Instance", value: "remove" },
            { name: "Upgrade an Instance", value: "upgrade" },
        ],
    });

    console.log();

    switch (mainAnswer.mainMenu) {
        case "list":
            list();
            break;
    }
};

const clear = () => {
    process.stdout.write("\x1b[2J");
    process.stdout.write("\x1b[0f");
};

const list = () => {
    const list: RegisteredInstance[] = NodeServiceFactory.instanceService.getAll();

    const table = new Table({
        head: ["Name", "Settings", "Server", "Version", "Last Run"],
        colWidths: [30, 30, 30, 30, 30],
    });

    if (list.length === 0) {
        console.log(chalk.red("There are no registered OmniHive instances"));

        table.push(["", "", "", "", ""]);
    } else {
        console.log(chalk.yellow("OmniHive Registered Instances"));

        list.forEach((instance: RegisteredInstance) => {
            table.push([
                instance.name,
                instance.settingsLocation,
                instance.serverLocation,
                instance.version,
                instance.lastRun.toString(),
            ]);
        });
    }

    console.log(table.toString());
};

init();
