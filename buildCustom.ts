import chalk from "chalk";
import childProcess from "child_process";
import dayjs from "dayjs";
import figlet from "figlet";
import fse from "fs-extra";
import path from "path";
import replaceInFile, { ReplaceInFileConfig } from "replace-in-file";
import yargs from "yargs";

const orangeHex: string = "#FFC022#";

const build = async (): Promise<void> => {
    const startTime: dayjs.Dayjs = dayjs();

    // Handle args
    const args = yargs(process.argv.slice(2));

    args
        .help(false)
        .version(false)
        .strict()
        .option("version", {
            alias: "v",
            type: "string",
            demandCommand: false,
            description: "OmniHive version to build against.  Will use latest if not provided",
        })
        .option("publish", {
            alias: "p",
            type: "boolean",
            demandCommand: false,
            description: "Publish to NPM",
            default: false,
        })
        .option("publishAccess", {
            alias: "a",
            type: "string",
            demandCommand: false,
            description: "Access to use when publishing to NPM",
            default: "public",
            choices: ["public", "restricted"],
        })
        .option("publishTag", {
            alias: "t",
            type: "string",
            demandCommand: false,
            description: "Tag to use when publishing",
        }).argv;

    // Handle version number

    let buildNumber: string;

    if (args.argv.version as string) {
        buildNumber = args.argv.version as string;
    } else {
        buildNumber = execSpawn("npm view omnihive dist-tags.latest", ".");
    }

    // Header
    console.log(chalk.yellow(figlet.textSync("OMNIHIVE")));
    console.log(chalk.hex(orangeHex)("Building OmniHive custom packages..."));
    console.log();

    // Clear out existing dist directory
    console.log(chalk.yellow("Clearing existing dist directory..."));
    fse.rmSync(path.join(`.`, `dist`), { recursive: true, force: true });
    console.log(chalk.greenBright("Done clearing existing dist directory..."));

    // Get all packages directories
    const customDirectories: string[] = fse
        .readdirSync(path.join(`.`, `src`, `custom`))
        .filter((f) => fse.statSync(path.join(`.`, `src`, `custom`, f)).isDirectory());

    customDirectories.forEach((value: string) => {
        console.log(chalk.yellow(`Building ${value}...`));
        execSpawn("yarn run build", path.join(`.`, `src`, `custom`, `${value}`));
        fse.copySync(
            path.join(`.`, `src`, `custom`, `${value}`, `package.json`),
            path.join(`.`, `dist`, `custom`, `${value}`, `package.json`)
        );
        execSpawn("npm pack", path.join(`.`, `dist`, `custom`, `${value}`));
        console.log(chalk.greenBright(`Done building ${value}...`));
    });

    // Patch package.json with latest OH version
    console.log(chalk.yellow("Patching package.json files..."));

    const replaceWorkspaceOptions: ReplaceInFileConfig = {
        allowEmptyPaths: true,
        files: [path.join(`dist`, `custom`, `**`, `package.json`)],
        from: /workspace:\*/g,
        to: `${buildNumber}`,
    };

    await replaceInFile.replaceInFile(replaceWorkspaceOptions);

    const replaceVersionOptions: ReplaceInFileConfig = {
        allowEmptyPaths: true,
        files: [path.join(`dist`, `custom`, `**`, `package.json`)],
        from: /"version": "0.0.1"/g,
        to: `"version": "${buildNumber}"`,
    };

    await replaceInFile.replaceInFile(replaceVersionOptions);

    console.log(chalk.greenBright("Done patching package.json files..."));

    // Check for publish flag and start publish if there
    if (!args.argv.publish as boolean) {
        console.log(chalk.redBright("Publish not specified...skipping npm publish"));
    } else {
        let publishString: string = "npm publish";

        if (args.argv.publishAccess) {
            publishString = `${publishString} --access ${args.argv.publishAccess as string}`;
        } else {
            publishString = `${publishString} --access public`;
        }

        if (args.argv.publishTag) {
            publishString = `${publishString} --tag ${args.argv.publishTag as string}`;
        }

        customDirectories.forEach((value: string) => {
            console.log(chalk.yellow(`Publishing ${value}...`));
            execSpawn(publishString, path.join(`.`, `dist`, `custom`, `${value}`));
            console.log(chalk.greenBright(`Done publishing ${value}...`));
        });
    }

    // Close out
    console.log();
    console.log(chalk.hex(orangeHex)("Done building OmniHive monorepo..."));
    console.log();

    const endTime: dayjs.Dayjs = dayjs();

    console.log(chalk.hex(orangeHex)(`Elapsed Time: ${endTime.diff(startTime, "seconds")} seconds`));
    process.exit();
};

const execSpawn = (commandString: string, cwd: string): string => {
    const execSpawn = childProcess.spawnSync(commandString, {
        shell: true,
        cwd,
        stdio: ["inherit", "pipe", "pipe"],
    });

    if (execSpawn.status !== 0) {
        console.log(chalk.red(execSpawn.stdout.toString().trim()));
        process.exit(1);
    }

    const execOut = execSpawn.stdout.toString().trim();

    if (execOut && execOut !== "") {
        return execOut;
    } else {
        return "";
    }
};

build();
