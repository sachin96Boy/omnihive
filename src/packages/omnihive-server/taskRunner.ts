import chalk from "chalk";
import figlet from "figlet";
import yargs from "yargs";
import { TaskRunnerService } from "./services/TaskRunnerService";

const init = async () => {
    const args = yargs(process.argv.slice(2));

    console.clear();
    console.log(chalk.yellow(figlet.textSync("OMNIHIVE")));
    console.log();

    args
        .help(false)
        .version(false)
        .strict()
        .option("name", {
            alias: "n",
            type: "string",
            demandOption: false,
            description: "Name of the instance you wish to launch",
        })
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
        .epilogue("Specifying -n loads the given instance name.  Specifying -s loads the given settings file.")
        .check((args) => {
            if (!args.settings && !args.instance) {
                throw new Error("You must specify -n or -s to load a settings file");
            }

            if (args.name && args.settings) {
                throw new Error(
                    "You cannot specify both -n and -s.  Either load a settings file, load an instance name, or manage the instances through the command line"
                );
            }

            return true;
        }).argv;

    const runnerService: TaskRunnerService = new TaskRunnerService();

    if (args.argv.settings) {
        await runnerService.start(
            undefined,
            args.argv.settings as string,
            args.argv.worker as string,
            args.argv.args as string
        );
    }

    if (args.argv.name) {
        await runnerService.start(
            args.argv.name as string,
            undefined,
            args.argv.worker as string,
            args.argv.args as string
        );
    }

    console.log(chalk.greenBright("Done with task runner..."));
    process.exit();
};

init();
