import chalk from "chalk";
import childProcess from "child_process";
import figlet from "figlet";
import fse from "fs-extra";
import path from "path";
import readPkgUp, { NormalizedReadResult } from "read-pkg-up";
import writePkg from "write-pkg";
import yargs from "yargs";
import { Listr } from "listr2";

// Master build process
const build = async (): Promise<void> => {
    // Handle args
    const args = yargs(process.argv.slice(2));

    args
        .help(false)
        .version(false)
        .strict()
        .option("debug", {
            alias: "d",
            type: "boolean",
            demandOption: false,
            description: "Debug Mode (Test Only)",
            default: false,
        })
        .option("tag", {
            alias: "t",
            type: "string",
            demandOption: false,
            description: "NPM Dist Tag",
            default: "latest",
        }).argv;

    // Header
    console.log(chalk.yellow(figlet.textSync("OMNIHIVE")));
    console.log();

    const tasks = setupTasks(args.argv.test as boolean, args.argv.tag as string);
    await tasks.run();
};

// Main Listr setup
const setupTasks = (testOnly: boolean, distTag: string): Listr<any> => {
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
            title: "Run Standard Version",
            task: () => runVersioning(testOnly),
            retry: 5,
            options: {
                persistentOutput: true,
                showTimer: true,
            },
        },
        {
            title: "Publish Packages",
            skip: (_ctx) => !testOnly,
            task: (_ctx, task): Listr =>
                task.newListr(
                    getPublishFolders().map((directory) => ({
                        title: `Publishing ${directory}`,
                        task: () => publish(directory, distTag),
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

const publish = (directory: string, distTag: string) => {
    fse.rmdirSync(path.join(`.`, `dist`, `packages`, directory, `tests`), { recursive: true });

    let publishString: string = "npm publish --access public";

    if (distTag !== "" && distTag !== "latest") {
        publishString = `${publishString} --tag ${distTag}`;
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

const runVersioning = (test: boolean) => {
    if (test) {
        execSpawn("yarn run release-dry-run", path.join(`.`));
    } else {
        execSpawn("yarn run release", path.join(`.`));
    }
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

// Master runner
build();
