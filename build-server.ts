import chalk from "chalk";
import execa from "execa";
import figlet from "figlet";
import fse from "fs-extra";
import { Listr } from "listr2";
import path from "path";
import replaceInFile, { ReplaceInFileConfig } from "replace-in-file";
import tar from "tar";
import yargs from "yargs";

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
            title: "Run Standard Version",
            task: () => runVersioning(debug),
            exitOnError: true,
            options: {
                showTimer: true,
            },
        },
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
            task: buildRepo,
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
            title: "Update Package Versions",
            task: async () => await updateVersion(),
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
        {
            title: "Push GitHub changes",
            skip: (_ctx) => debug,
            task: pushGithubChanges,
            exitOnError: true,
            options: {
                showTimer: true,
            },
        },
    ]);
};

// Helpers
const buildRepo = () => {
    execa.commandSync("npx tsc -b --force", { cwd: path.join(`..`) });
};

const clearOutExistingDist = () => {
    fse.rmSync(path.join(`..`, `dist`), { recursive: true, force: true });
};

const copyRequiredFile = (file: string) => {
    fse.copyFileSync(path.join(`..`, `src`, `${file}`), path.join(`..`, `dist`, `${file}`));
};

const copyRequiredFolder = (folder: string) => {
    fse.copySync(path.join(`..`, `src`, `${folder}`), path.join(`..`, `dist`, `${folder}`));
};

const createTarball = () => {
    tar.c(
        {
            gzip: true,
            cwd: path.join("..", "dist", "server", "omnihive"),
        },
        [".."]
    ).pipe(fse.createWriteStream("./omnihive.tgz"));
};

const getPublishFolders = () => {
    // Get all packages directories
    return fse
        .readdirSync(path.join(`..`, `dist`))
        .filter((f) => fse.statSync(path.join(`..`, `dist`, f)).isDirectory());
};

const getRequiredFiles = () => {
    return [
        path.join(`omnihive`, `.npmignore`),
        path.join(`omnihive-worker-knex-mssql`, `.npmignore`),
        path.join(`omnihive-worker-knex-mysql`, `.npmignore`),
        path.join(`omnihive-worker-knex-postgres`, `.npmignore`),
        path.join(`omnihive-worker-knex-sqlite`, `.npmignore`),
    ];
};

const getRequiredFolders = () => {
    return [
        path.join(`omnihive`, `app`),
        path.join(`omnihive-worker-knex-mssql`, `scripts`),
        path.join(`omnihive-worker-knex-mysql`, `scripts`),
        path.join(`omnihive-worker-knex-postgres`, `scripts`),
        path.join(`omnihive-worker-knex-sqlite`, `scripts`),
    ];
};

const isEmptyString = (value: unknown): boolean => {
    return isString(value) && String(value).length === 0;
};

const isEmptyStringOrWhitespace = (value: unknown): boolean => {
    return isEmptyString(value) || isWhiteSpaceString(value);
};

const isNull = (value: unknown): value is null => {
    return value === null;
};

const isNullOrUndefined = (value: unknown): value is null | undefined => {
    return isNull(value) || isUndefined(value);
};

const isString = (value: unknown): value is string => {
    return typeof value === "string";
};

const isUndefined = (value: unknown): value is undefined => {
    return typeof value === "undefined" || value === undefined;
};

const isWhiteSpaceString = (value: unknown): value is string => {
    return isString(value) && !isEmptyString(value) && !/\S/.test(String(value));
};

const publish = (directory: string, distTag: string) => {
    fse.rmdirSync(path.join(`..`, `dist`, directory, `tests`), { recursive: true });

    let publishString: string = "npm publish --access public";

    if (!isEmptyStringOrWhitespace(distTag) && distTag !== "latest") {
        publishString = `${publishString} --tag ${distTag}`;
    }

    console.log(`Publishing NPM Package at ${directory}`);
    execa.commandSync(publishString, { cwd: path.join(`..`, `dist`, `${directory}`) });
};

const removeNonCorePackagesFromMainPackageJson = () => {
    // Get package.json
    const packageJson = JSON.parse(fse.readFileSync(path.join(`..`, `dist`, `omnihive`), { encoding: "utf8" }));

    if (isNullOrUndefined(packageJson)) {
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
            if (!isNullOrUndefined(packageJson.dependencies)) {
                delete packageJson.dependencies[loadedPackage[0]];
            }
        }
    }

    if (!isNullOrUndefined(packageJson)) {
        fse.writeFileSync(path.join(`..`, `dist`, `omnihive`), JSON.stringify(packageJson));
    }
};

const pushGithubChanges = () => {
    execa.commandSync(`git push --follow-tags origin main`, { cwd: path.join(`..`) });
};

const runVersioning = (debug: boolean) => {
    if (debug) {
        console.log(execa.commandSync("yarn run release:dry-run", { cwd: path.join(`..`), shell: true }).stdout);
    } else {
        console.log(execa.commandSync("yarn run release", { cwd: path.join(`..`), shell: true }).stdout);
    }
};

const updateVersion = async () => {
    // Get package.json
    const packageJson = JSON.parse(fse.readFileSync(path.join(`..`, `dist`, `omnihive`), { encoding: "utf8" }));

    if (isNullOrUndefined(packageJson)) {
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

    const replaceVersionOptions: ReplaceInFileConfig = {
        allowEmptyPaths: true,
        files: [path.join(`dist`, `**`, `package.json`)],
        from: /"version": "0.0.1"/g,
        to: `"version": "${currentVersion}"`,
    };

    await replaceInFile.replaceInFile(replaceVersionOptions);
};

// Master runner
build();