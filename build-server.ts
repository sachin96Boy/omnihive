import chalk from "chalk";
import execa from "execa";
import figlet from "figlet";
import fse from "fs-extra";
import { Listr } from "listr2";
import path from "path";
import replaceInFile, { ReplaceInFileConfig } from "replace-in-file";
import tar from "tar";
import yargs from "yargs";
import rimraf from "rimraf";

// Master build process
const build = async (): Promise<void> => {
    // Handle args
    const cmdLineArgs = yargs(process.argv.slice(2));

    cmdLineArgs
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
        });

    const args = await cmdLineArgs.argv;

    // Header
    console.log(chalk.yellow(figlet.textSync("OMNIHIVE")));
    console.log();

    const tasks = setupTasks(args.debug as boolean, args.tag as string);

    try {
        await tasks.run();
    } catch (err) {
        console.log(err);
        process.exit(1);
    }
};

// Main Listr setup
const setupTasks = (debug: boolean, distTag: string): Listr<any> => {
    return new Listr<any>([
        {
            title: "Clear Out Existing Dist Directories",
            task: clearOutExistingDist,
            exitOnError: true,
            options: {
                showTimer: true,
            },
        },
        {
            title: "Build Repo",
            task: async () => await buildRepo(),
            exitOnError: true,
            options: {
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
                            task: () => copyRequiredFile(file),
                        })),
                        ...getRequiredFolders().map((directory) => ({
                            title: `Copying Required Directories`,
                            task: () => copyRequiredFolder(directory),
                            options: {
                                showTimer: true,
                                showSubtasks: true,
                            },
                        })),
                    ],
                    { concurrent: true }
                ),
            exitOnError: true,
            options: {
                showTimer: true,
            },
        },
        {
            title: "Remove non-core packages from OmniHive package.json",
            task: () => removeNonCorePackagesFromMainPackageJson(),
            exitOnError: true,
            options: {
                showTimer: true,
            },
        },
        {
            title: "Update Workspace Versions",
            task: async () => await updateWorkspaceVersion(),
            options: {
                showTimer: true,
            },
        },
        {
            title: "Create release tarball",
            task: createTarball,
            options: {
                showTimer: true,
            },
        },
        {
            title: "Publish Packages",
            skip: (_ctx) => debug,
            task: (_ctx, task): Listr =>
                task.newListr(
                    getPublishFolders().map((directory) => ({
                        title: `Publishing ${directory}`,
                        task: () => publish(directory, distTag),
                        retry: 5,
                        options: {
                            showTimer: true,
                            showSubtasks: true,
                        },
                    })),
                    { concurrent: true }
                ),
            exitOnError: true,
            options: {
                showTimer: true,
            },
        },
    ]);
};

// Helpers
const buildRepo = async () => {
    fse.readdirSync(path.join(`.`, `src`, `common`))
        .filter((f) => fse.statSync(path.join(`.`, `src`, `common`, f)).isDirectory())
        .forEach((directory) => {
            execa.commandSync("pnpm run build:prod", { cwd: path.join(`.`, `src`, `common`, directory) });
            rimraf(path.join(`.`, `dist`, `common`, directory, `tests`), () => {});
            fse.rm(path.join(`.`, `dist`, `common`, directory, `tsconfig.prod.tsbuildinfo`));
        });

    execa.commandSync("pnpm run build:prod", { cwd: path.join(`.`, `src`, `server`, `omnihive-worker-log-null`) });
    execa.commandSync("pnpm run build:prod", { cwd: path.join(`.`, `src`, `server`, `omnihive-worker-log-console`) });

    fse.readdirSync(path.join(`.`, `src`, `server`))
        .filter((f) => fse.statSync(path.join(`.`, `src`, `server`, f)).isDirectory())
        .forEach((directory) => {
            execa.commandSync("pnpm run build:prod", { cwd: path.join(`.`, `src`, `server`, directory) });
            rimraf(path.join(`.`, `dist`, `server`, directory, `tests`), () => {});
            fse.rm(path.join(`.`, `dist`, `server`, directory, `tsconfig.prod.tsbuildinfo`));
        });
};

const clearOutExistingDist = () => {
    fse.rmSync(path.join(`.`, `dist`), { recursive: true, force: true });
};

const copyRequiredFile = (file: string) => {
    fse.copyFileSync(path.join(`.`, `src`, `${file}`), path.join(`.`, `dist`, `${file}`));
};

const copyRequiredFolder = (folder: string) => {
    fse.copySync(path.join(`.`, `src`, `${folder}`), path.join(`.`, `dist`, `${folder}`));
};

const createTarball = () => {
    tar.c(
        {
            gzip: true,
            cwd: path.join(".", "dist", "server", "omnihive"),
        },
        ["."]
    ).pipe(fse.createWriteStream("./omnihive.tgz"));
};

const getPublishFolders = () => {
    // Get all packages directories
    const directories: string[] = [];

    fse.readdirSync(path.join(`.`, `dist`, `common`))
        .filter((f) => fse.statSync(path.join(`.`, `dist`, `common`, f)).isDirectory())
        .forEach((directory: string) => directories.push(path.join(`common`, directory)));

    fse.readdirSync(path.join(`.`, `dist`, `server`))
        .filter((f) => fse.statSync(path.join(`.`, `dist`, `server`, f)).isDirectory())
        .forEach((directory: string) => directories.push(path.join(`server`, directory)));

    return directories;
};

const getRequiredFiles = () => {
    return [
        path.join(`server`, `omnihive`, `.npmignore`),
        path.join(`server`, `omnihive-worker-knex-mssql`, `.npmignore`),
        path.join(`server`, `omnihive-worker-knex-mysql`, `.npmignore`),
        path.join(`server`, `omnihive-worker-knex-postgres`, `.npmignore`),
        path.join(`server`, `omnihive-worker-knex-sqlite`, `.npmignore`),
        path.join(`server`, `omnihive-worker-config-mssql`, `.npmignore`),
        path.join(`server`, `omnihive-worker-config-mysql`, `.npmignore`),
        path.join(`server`, `omnihive-worker-config-postgres`, `.npmignore`),
        path.join(`server`, `omnihive-worker-config-sqlite`, `.npmignore`),
        path.join(`server`, `omnihive-worker-config-mssql`, `defaultConfig.sql`),
        path.join(`server`, `omnihive-worker-config-mysql`, `defaultConfig.sql`),
        path.join(`server`, `omnihive-worker-config-postgres`, `defaultConfig.sql`),
        path.join(`server`, `omnihive-worker-config-sqlite`, `defaultConfig.sql`),
    ];
};

const getRequiredFolders = () => {
    return [
        path.join(`server`, `omnihive`, `app`),
        path.join(`server`, `omnihive-worker-knex-mssql`, `scripts`),
        path.join(`server`, `omnihive-worker-knex-mysql`, `scripts`),
        path.join(`server`, `omnihive-worker-knex-postgres`, `scripts`),
        path.join(`server`, `omnihive-worker-knex-sqlite`, `scripts`),
    ];
};

const publish = (directory: string, distTag: string) => {
    let publishString: string = "npm publish --access public";

    if (distTag !== "" && distTag !== "latest") {
        publishString = `${publishString} --tag ${distTag}`;
    }

    console.log(`Publishing NPM Package at ${directory}`);
    execa.commandSync(publishString, { cwd: path.join(`.`, `dist`, `${directory}`) });
};

const removeNonCorePackagesFromMainPackageJson = () => {
    // Get package.json
    const packageJson = JSON.parse(
        fse.readFileSync(path.join(`.`, `dist`, `server`, `omnihive`, `package.json`), { encoding: "utf8" })
    );

    if (!packageJson) {
        throw new Error("OmniHive package.json not found");
    }

    const corePackages: any = packageJson?.omniHive.coreDependencies;
    const loadedPackages: any = packageJson?.dependencies;

    for (const loadedPackage of Object.entries(loadedPackages)) {
        let removeLoadedPackage: boolean = true;

        for (const corePackage of Object.entries(corePackages)) {
            if (corePackage[0] === loadedPackage[0] && corePackage[1] === loadedPackage[1]) {
                removeLoadedPackage = false;
                break;
            }
        }

        if (removeLoadedPackage) {
            if (packageJson.dependencies) {
                delete packageJson.dependencies[loadedPackage[0]];
            }
        }
    }

    if (packageJson) {
        fse.writeFileSync(
            path.join(`.`, `dist`, `server`, `omnihive`, `package.json`),
            JSON.stringify(packageJson, null, 2)
        );
    }
};

const updateWorkspaceVersion = async () => {
    // Get package.json
    const packageJson = JSON.parse(
        fse.readFileSync(path.join(`.`, `dist`, `server`, `omnihive`, `package.json`), { encoding: "utf8" })
    );

    if (!packageJson) {
        throw new Error("Update version cannot find the main package.json");
    }

    const currentVersion: string = packageJson.version;

    const replaceWorkspaceOptions: ReplaceInFileConfig = {
        allowEmptyPaths: true,
        files: [path.join(`dist`, `**`, `package.json`)],
        from: /workspace:\*/g,
        to: `${currentVersion}`,
    };

    await replaceInFile.replaceInFile(replaceWorkspaceOptions);
};

// Master runner
build();
