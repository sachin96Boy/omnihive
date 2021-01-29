import chalk from "chalk";
import figlet from "figlet";
import yargs from "yargs";
import { ServerService } from "./services/ServerService";

const init = async () => {
    const args = yargs(process.argv.slice(2));

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
        .option("rebuildSchema", {
            alias: "rs",
            type: "boolean",
            demandOption: false,
            description: "Force schema rebuild irrespective of server settings",
        })
        .epilogue("Specifying -n loads the given instance name.  Specifying -s loads the given settings file.")
        .check((args) => {
            if (!args.name && !args.settings) {
                if (!process.env.omnihive_settings) {
                    throw new Error(
                        "You must specify -n or -s to load a settings file or have an env variable of omnihive_settings.  Use -n for a saved instance or -s to load a settings file directly."
                    );
                } else {
                    args.settings = process.env.omnihive_settings as string;
                }
            }

            if (args.name && args.settings) {
                throw new Error(
                    "You cannot specify both -n and -s.  Either load a settings file, load an instance name, or manage the instances through the command line"
                );
            }

            return true;
        }).argv;

    clear();
    console.log(chalk.yellow(figlet.textSync("OMNIHIVE")));
    console.log();

    const serverService: ServerService = new ServerService();
    let rebuildSchema: boolean | undefined = undefined;

    if (args.argv.rebuildSchema) {
        rebuildSchema = args.argv.rebuildSchema as boolean;
    }

    if (!args.argv.settings && !args.argv.name) {
        serverService.start(undefined, undefined, rebuildSchema);
    }

    if (args.argv.settings) {
        serverService.start(undefined, args.argv.settings as string, rebuildSchema);
    }

    if (args.argv.name) {
        serverService.start(args.argv.name as string, undefined, rebuildSchema);
    }
};

const clear = () => {
    process.stdout.write("\x1b[2J");
    process.stdout.write("\x1b[0f");
};

init();
