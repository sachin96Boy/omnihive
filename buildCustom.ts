import chalk from "chalk";
import childProcess from "child_process";
import figlet from "figlet";
import fse from "fs-extra";
import path from "path";
import replaceInFile, { ReplaceInFileConfig } from "replace-in-file";
import yargs from "yargs";
import axios from "axios";
import { Listr } from "listr2";
import semver from "semver";

const build = async (): Promise<void> => {
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
            alias: "pa",
            type: "string",
            demandCommand: false,
            description: "Access to use when publishing to NPM",
            default: "public",
            choices: ["public", "restricted"],
        })
        .option("publishTag", {
            alias: "pt",
            type: "string",
            demandCommand: false,
            description: "Tag to use when publishing",
        }).argv;

    // Handle version number

    let buildNumber: string;

    if (args.argv.version as string) {
        buildNumber = args.argv.version as string;
    } else {
        const versions = (await axios.get("https://registry.npmjs.org/-/package/omnihive/dist-tags")).data;
        buildNumber = versions.latest;
    }

    // Header
    console.log(chalk.yellow(figlet.textSync("OMNIHIVE")));
    console.log();

    const tasks = setupTasks(args, buildNumber);
    await tasks.run();
};

// Main Listr setup
const setupTasks = (args: any, version: string): Listr<any> => {
    return new Listr<any>([
        {
            title: "Clear Out Existing Dist Directories",
            task: clearOutExistingDist,
            retry: 5,
            options: {
                persistentOutput: true,
                showTimer: true,
            },
        },
        {
            title: "Build Repo",
            task: buildRepo,
            retry: 5,
            options: {
                persistentOutput: true,
                showTimer: true,
            },
        },
        {
            title: "Update Package Versions",
            task: async () => await updateVersion(version),
            retry: 5,
            options: {
                persistentOutput: true,
                showTimer: true,
            },
        },
        {
            title: "Publish Packages",
            skip: (_ctx) => !getPublishFlag(args),
            task: (_ctx, task): Listr =>
                task.newListr(
                    getPublishFolders().map((directory) => ({
                        title: `Publishing ${directory}`,
                        task: () => publish(args, directory),
                        retry: 5,
                        options: {
                            persistentOutput: true,
                            showTimer: true,
                            suffixRetries: true,
                            showSubtasks: true,
                        },
                    })),
                    { concurrent: true }
                ),
            retry: 5,
            options: {
                persistentOutput: true,
                showTimer: true,
            },
        },
    ]);
};

// Listr task helpers
const buildRepo = () => {
    execSpawn("npx tsc -b --force", path.join(`.`));
};

const clearOutExistingDist = () => {
    // Clear out existing dist directory
    fse.rmSync(path.join(`.`, `dist`), { recursive: true, force: true });
};

const getPublishFolders = () => {
    // Get all packages directories
    return fse
        .readdirSync(path.join(`.`, `dist`, `custom`))
        .filter((f) => fse.statSync(path.join(`.`, `dist`, `custom`, f)).isDirectory());
};

const publish = (args: any, directory: string) => {
    fse.rmdirSync(path.join(`.`, `dist`, `packages`, directory, `tests`), { recursive: true });

    let publishString: string = "npm publish";

    if (args.argv.publishAccess) {
        publishString = `${publishString} --access ${args.argv.publishAccess as string}`;
    } else {
        publishString = `${publishString} --access public`;
    }

    if (args.argv.publishTag) {
        publishString = `${publishString} --tag ${args.argv.publishTag as string}`;
    }

    execSpawn(publishString, path.join(`.`, `dist`, `custom`, `${directory}`));
    execSpawn("npm pack", path.join(`.`, `dist`, `custom`, `${directory}`));
};

const updateVersion = async (buildNumber: string) => {
    // Patch package.json with latest OH version
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
};

// Helper functions

const execSpawn = (commandString: string, cwd: string): string => {
    const execSpawn = childProcess.spawnSync(commandString, {
        shell: true,
        cwd,
        stdio: ["inherit", "pipe", "pipe"],
    });

    if (execSpawn.status !== 0) {
        if (execSpawn.stdout?.length > 0) {
            console.log(chalk.red(execSpawn.stdout.toString().trim()));
        } else if (execSpawn.stderr?.length > 0) {
            console.log(chalk.red(execSpawn.stderr.toString().trim()));
        } else if (execSpawn.error) {
            console.log(chalk.red(execSpawn.error.message));
        }
        process.exit(1);
    }

    const execOut = execSpawn.stdout.toString().trim();

    if (execOut && execOut !== "") {
        return execOut;
    } else {
        return "";
    }
};

const getPublishFlag = (args: any) => args.argv.publish as boolean;

build();
