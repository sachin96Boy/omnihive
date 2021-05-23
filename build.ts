import chalk from "chalk";
import childProcess from "child_process";
import figlet from "figlet";
import fse from "fs-extra";
import path from "path";
import readPkgUp, { NormalizedReadResult } from "read-pkg-up";
import replaceInFile, { ReplaceInFileConfig } from "replace-in-file";
import semver from "semver";
import writePkg from "write-pkg";
import yargs from "yargs";
import axios from "axios";
import { Listr } from "listr2";

// Version holder
type Version = {
    main: string;
    beta: string;
    dev: string;
};

// Master build process
const build = async (): Promise<void> => {
    // Reset version
    let version: Version = {
        main: "",
        beta: "",
        dev: "",
    };

    // Get the current git branch
    const currentBranch: string = execSpawn("git branch --show-current", "./");

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
            description: "Build number to use.  Will use WOV Elastic provider if not provided",
        })
        .option("channel", {
            alias: "c",
            type: "string",
            demandOption: false,
            description: "Name of the channel you wish to build",
            choices: ["dev", "beta", "main"],
        })
        .option("type", {
            alias: "t",
            type: "string",
            demandOption: false,
            description: "Release type (major, minor, patch, prerelease)",
            choices: ["major", "minor", "patch", "prerelease"],
        })
        .option("publish", {
            alias: "p",
            type: "boolean",
            demandOption: false,
            description: "Publish to NPM and GitHub",
            default: false,
        })
        .option("publishAccess", {
            alias: "pa",
            type: "string",
            demandOption: false,
            description: "Access to use when publishing to NPM",
            choices: ["public", "restricted"],
        })
        .option("publishTag", {
            alias: "pt",
            type: "string",
            demandOption: false,
            description: "Tag to use when publishing",
        })
        .check((args) => {
            if (args.version && (args.channel || args.type)) {
                throw new Error("You cannot specify a predetermined version and specify a channel and/or a type");
            }

            if ((args.publishAccess || args.publishTag) && (args.publish === undefined || args.publish === false)) {
                throw new Error("You must add a publish flag to use tagging or access levels");
            }

            if (args.channel && args.channel !== currentBranch) {
                throw new Error(
                    "Your selected channel and your current git branch do not match.  Please choose a different channel or switch branches in git."
                );
            }

            if (args.channel === "main" && args.type === "prerelease") {
                throw new Error(
                    "You cannot specify the main channel and specify prerelease.  Prerelease is for dev and beta channels only."
                );
            }

            if (
                (args.channel === "dev" || args.channel === "beta") &&
                (args.type === "major" || args.type === "minor" || args.type === "patch")
            ) {
                throw new Error(
                    "You cannot specify a prerelease type and specify the main channel.  Prerelease is the only option for the dev or beta channel."
                );
            }
            return true;
        }).argv;

    if (!args.argv.version) {
        const versions = (await axios.get("https://registry.npmjs.org/-/package/omnihive/dist-tags")).data;

        version = {
            main: versions.latest,
            beta: versions.beta,
            dev: versions.dev,
        };
    } else {
        version = {
            main: args.argv.version as string,
            beta: args.argv.version as string,
            dev: args.argv.version as string,
        };
    }

    // Header
    console.log(chalk.yellow(figlet.textSync("OMNIHIVE")));
    console.log();

    const tasks = setupTasks(args, version);
    await tasks.run();
};

// Main Listr setup
const setupTasks = (args: any, version: Version): Listr<any> => {
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
            title: "Copy required files and folders",
            task: (_ctx, task): Listr =>
                task.newListr(
                    [
                        ...getRequiredFiles().map((file) => ({
                            title: `Copying Required Files`,
                            task: async () => await copyRequiredFile(file),
                        })),
                        ...getRequiredFolders().map((directory) => ({
                            title: `Copying Required Directories`,
                            task: async () => await copyRequiredFolder(directory),
                            retry: 5,
                            options: {
                                persistentOutput: true,
                                showTimer: true,
                                suffixRetries: true,
                                showSubtasks: true,
                            },
                        })),
                    ],
                    { concurrent: true }
                ),
            retry: 5,
            options: {
                persistentOutput: true,
                showTimer: true,
            },
        },
        {
            title: "Remove non-core packages from OmniHive package.json",
            task: removeNonCorePackagesFromMainPackageJson,
            retry: 5,
            options: {
                persistentOutput: true,
                showTimer: true,
            },
        },
        {
            title: "Update Package Versions",
            task: async () => await updateVersion(args, version),
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

const copyRequiredFile = async (file: string) => {
    await fse.copyFile(path.join(`.`, `src`, `packages`, `${file}`), path.join(`.`, `dist`, `packages`, `${file}`));
};

const copyRequiredFolder = async (folder: string) => {
    await fse.copy(path.join(`.`, `src`, `packages`, `${folder}`), path.join(`.`, `dist`, `packages`, `${folder}`));
};

const getPublishFolders = () => {
    // Get all packages directories
    return fse
        .readdirSync(path.join(`.`, `dist`, `packages`))
        .filter((f) => fse.statSync(path.join(`.`, `dist`, `packages`, f)).isDirectory());
};

const getRequiredFiles = () => {
    return [
        path.join(`omnihive`, `.npmignore`),
        path.join(`omnihive-worker-knex-mssql`, `.npmignore`),
        path.join(`omnihive-worker-knex-mssql`, `defaultProcFunctions.sql`),
        path.join(`omnihive-worker-knex-mssql`, `defaultTables.sql`),
        path.join(`omnihive-worker-knex-mysql`, `.npmignore`),
        path.join(`omnihive-worker-knex-mysql`, `defaultProcFunctions.sql`),
        path.join(`omnihive-worker-knex-mysql`, `defaultTables.sql`),
        path.join(`omnihive-worker-knex-postgres`, `.npmignore`),
        path.join(`omnihive-worker-knex-postgres`, `defaultProcFunctions.sql`),
        path.join(`omnihive-worker-knex-postgres`, `defaultTables.sql`),
        path.join(`omnihive-worker-knex-sqlite`, `.npmignore`),
        path.join(`omnihive-worker-knex-sqlite`, `defaultTables.sql`),
    ];
};

const getRequiredFolders = () => {
    return [path.join(`omnihive`, `app`, `public`), path.join(`omnihive`, `app`, `views`)];
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

    execSpawn(publishString, path.join(`.`, `dist`, `packages`, `${directory}`));
    execSpawn("npm pack", path.join(`.`, `dist`, `packages`, `${directory}`));
};

const removeNonCorePackagesFromMainPackageJson = async () => {
    const packageJson: NormalizedReadResult | undefined = await readPkgUp({
        cwd: path.join(`.`, `dist`, `packages`, `omnihive`),
    });

    const corePackages: any = packageJson?.packageJson.omniHive.coreDependencies;
    const loadedPackages: any = packageJson?.packageJson.dependencies;

    for (const loadedPackage of Object.entries(loadedPackages)) {
        let removeLoadedPackage: boolean = true;

        for (const corePackage of Object.entries(corePackages)) {
            if (corePackage[0] === loadedPackage[0] && corePackage[1] === loadedPackage[1]) {
                removeLoadedPackage = false;
                break;
            }
        }

        if (removeLoadedPackage) {
            if (packageJson && packageJson.packageJson && packageJson.packageJson.dependencies) {
                delete packageJson.packageJson.dependencies[loadedPackage[0]];
            }
        }
    }

    if (packageJson && packageJson.packageJson) {
        await writePkg(path.join(`.`, `dist`, `packages`, `omnihive`), packageJson.packageJson);
    }
};

const updateVersion = async (args: any, version: Version) => {
    let currentVersion: string = "";

    if (args.argv.version) {
        currentVersion = version.main;
    } else {
        switch (args.argv.type) {
            case "prerelease":
                switch (args.argv.channel) {
                    case "dev":
                        currentVersion = semver.inc(version.dev, "prerelease", false, "dev") ?? "";

                        if (!currentVersion || currentVersion === "") {
                            throw new Error("SemVer is incorrect");
                        }

                        version.dev = currentVersion;
                        break;
                    case "beta":
                        currentVersion = semver.inc(version.beta, "prerelease", false, "beta") ?? "";

                        if (!currentVersion || currentVersion === "") {
                            throw new Error("SemVer is incorrect");
                        }

                        version.beta = currentVersion;
                        break;
                    default:
                        throw new Error("Must have dev or beta channel with prerelease");
                }
                break;
            case "major":
                currentVersion = semver.inc(version.main, "major") ?? "";

                if (!currentVersion || currentVersion === "") {
                    throw new Error("SemVer is incorrect");
                }

                version.main = currentVersion;
                version.beta = semver.inc(currentVersion, "prerelease", false, "beta") ?? "";
                version.dev = semver.inc(currentVersion, "prerelease", false, "dev") ?? "";
                break;
            case "minor":
                currentVersion = semver.inc(version.main, "minor") ?? "";

                if (!currentVersion || currentVersion === "") {
                    throw new Error("SemVer is incorrect");
                }

                version.main = currentVersion;
                version.beta = semver.inc(currentVersion, "prerelease", false, "beta") ?? "";
                version.dev = semver.inc(currentVersion, "prerelease", false, "dev") ?? "";
                break;
            default:
                currentVersion = semver.inc(version.main, "patch") ?? "";

                if (!currentVersion || currentVersion === "") {
                    throw new Error("SemVer is incorrect");
                }

                version.main = currentVersion;
                version.beta = semver.inc(currentVersion, "prerelease", false, "beta") ?? "";
                version.dev = semver.inc(currentVersion, "prerelease", false, "dev") ?? "";
                break;
        }
    }

    // Patch package.json with SemVer
    const replaceWorkspaceOptions: ReplaceInFileConfig = {
        allowEmptyPaths: true,
        files: [path.join(`dist`, `packages`, `**`, `package.json`)],
        from: /workspace:\*/g,
        to: `${currentVersion}`,
    };

    await replaceInFile.replaceInFile(replaceWorkspaceOptions);

    const replaceVersionOptions: ReplaceInFileConfig = {
        allowEmptyPaths: true,
        files: [path.join(`dist`, `packages`, `**`, `package.json`)],
        from: /"version": "0.0.1"/g,
        to: `"version": "${currentVersion}"`,
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
            throw new Error(execSpawn.stdout.toString().trim());
        } else if (execSpawn.stderr?.length > 0) {
            throw new Error(execSpawn.stderr.toString().trim());
        } else if (execSpawn.error) {
            throw new Error(execSpawn.error.message);
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

// Master runner
build();
