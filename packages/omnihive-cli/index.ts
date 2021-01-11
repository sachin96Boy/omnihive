#!/usr/bin/env node

import clear from "clear";
import chalk from "chalk";
import figlet from "figlet";

clear();

console.log(
    chalk.yellowBright(
        figlet.textSync("OMNIHIVE", { horizontalLayout: "full" })
    )
);