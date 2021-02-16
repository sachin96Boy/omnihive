import chalk from "chalk";
import childProcess from "child_process";
import figlet from "figlet";
import fse from "fs-extra";
import { join } from "path";
import replaceInFile, { ReplaceInFileConfig } from "replace-in-file";
import semver from "semver";
import yargs from "yargs";
import { Client } from "@elastic/elasticsearch";
import readPkgUp from "read-pkg-up";
import writePkg from "write-pkg";

// Elastic version record
type Version = {
    main: string;
    beta: string;
    dev: string;
};

const build = async (): Promise<void> => {
    // Check if Elastic settings are available and get versions
    if (
        !process.env.omnihive_build_elastic_cloudId ||
        !process.env.omnihive_build_elastic_cloudPassword ||
        !process.env.omnihive_build_elastic_cloudUser
    ) {
        throw new Error("There are no elastic settings so the build cannot continue.");
    }

    const elasticClient = new Client({
        cloud: {
            id: process.env.omnihive_build_elastic_cloudId,
        },
        auth: {
            username: process.env.omnihive_build_elastic_cloudUser,
            password: process.env.omnihive_build_elastic_cloudPassword,
        },
    });

    const versionDoc = await elasticClient.get({ index: "master-version", id: "1" });
    const version: Version = versionDoc.body._source as Version;

    // Get the current git branch
    const currentBranch: string = execSpawn("git branch --show-current", "./");

    // Handle args
    const args = yargs(process.argv.slice(2));

    args
        .help(false)
        .version(false)
        .strict()
        .option("channel", {
            alias: "c",
            type: "string",
            demandOption: true,
            description: "Name of the channel you wish to build",
            choices: ["dev", "beta", "main"],
            default: "dev",
        })
        .option("type", {
            alias: "t",
            type: "string",
            demandOption: false,
            description: "Release type (major, minor, patch, prerelease)",
            choices: ["major", "minor", "patch", "prerelease"],
            default: "prerelease",
        })
        .option("publish", {
            alias: "p",
            type: "boolean",
            demandCommand: false,
            description: "Publish to NPM",
            default: false,
        })
        .check((args) => {
            if (args.channel !== currentBranch) {
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

    // Header
    console.log(chalk.yellow(figlet.textSync("OMNIHIVE")));
    console.log(chalk.hex("#FFC022")("Building OmniHive monorepo..."));
    console.log();

    // Clear out existing dist directory
    console.log(chalk.yellow("Clearing existing dist directory..."));
    fse.rmSync("./dist", { recursive: true, force: true });
    console.log(chalk.greenBright("Done clearing existing dist directory..."));

    // Get all packages directories
    const directories: string[] = fse
        .readdirSync("./src/packages")
        .filter((f) => fse.statSync(join("./src/packages", f)).isDirectory());
    const customDirectories: string[] = fse
        .readdirSync("./src/custom")
        .filter((f) => fse.statSync(join("./src/custom", f)).isDirectory());

    // Build core libraries
    console.log();
    console.log(chalk.blue("Building core libraries..."));

    directories
        .filter((value: string) => value === "omnihive-core")
        .forEach((value: string) => {
            console.log(chalk.yellow(`Building ${value}...`));
            execSpawn("yarn run build", `./src/packages/${value}`);
            console.log(chalk.greenBright(`Done building ${value}...`));
        });

    directories
        .filter((value: string) => value === "omnihive-core-node")
        .forEach((value: string) => {
            console.log(chalk.yellow(`Building ${value}...`));
            execSpawn("yarn run build", `./src/packages/${value}`);
            console.log(chalk.greenBright(`Done building ${value}...`));
        });

    console.log(chalk.blue("Done building core libraries..."));
    console.log();

    // Build workers
    console.log(chalk.blue("Building workers..."));

    directories
        .filter((value: string) => value.startsWith("omnihive-worker"))
        .forEach((value: string) => {
            console.log(chalk.yellow(`Building ${value}...`));
            execSpawn("yarn run build", `./src/packages/${value}`);
            console.log(chalk.greenBright(`Done building ${value}...`));
        });

    console.log(chalk.blue("Done building workers..."));
    console.log();

    // Build custom workers
    console.log(chalk.blue("Building custom workers..."));

    customDirectories.forEach((value: string) => {
        console.log(chalk.yellow(`Building ${value}...`));
        execSpawn("yarn run build", `./src/custom/${value}`);
        console.log(chalk.greenBright(`Done building ${value}...`));
    });

    console.log(chalk.blue("Done building custom workers..."));
    console.log();

    // Build client and server
    console.log(chalk.blue("Building client and server..."));

    directories
        .filter((value: string) => value === "omnihive-client")
        .forEach((value: string) => {
            console.log(chalk.yellow(`Building ${value}...`));
            execSpawn("yarn run build", `./src/packages/${value}`);
            console.log(chalk.greenBright(`Done building ${value}...`));
        });

    directories
        .filter((value: string) => value === "omnihive")
        .forEach((value: string) => {
            console.log(chalk.yellow(`Building main server package ${value}...`));
            execSpawn("yarn run build", `./src/packages/${value}`);
            console.log(chalk.greenBright(`Done building main server package ${value}...`));
        });

    //Copy over miscellaneous files (npmignore, pug, etc.)
    console.log(chalk.yellow("Copying miscellaneous OmniHive files..."));

    const miscFiles = [".npmignore"];

    miscFiles.forEach((value: string) => {
        fse.copyFileSync(`./src/packages/omnihive/${value}`, `./dist/packages/omnihive/${value}`);
    });

    const miscFolders = ["public", "views"];

    miscFolders.forEach((value: string) => {
        fse.copySync(`./src/packages/omnihive/${value}`, `./dist/packages/omnihive/${value}`);
    });

    console.log(chalk.greenBright("Done copying miscellaneous OmniHive files..."));

    //Remove non-core packages from package.json in server
    console.log(chalk.yellow("Removing non-core packages from OmniHive package.json..."));

    const packageJson: readPkgUp.NormalizedReadResult | undefined = await readPkgUp({
        cwd: `./dist/packages/omnihive`,
    });

    const corePackages: any = packageJson.packageJson.omniHive.coreDependencies;
    const loadedPackages: any = packageJson.packageJson.dependencies;

    for (const loadedPackage of Object.entries(loadedPackages)) {
        let removeLoadedPackage: boolean = true;

        for (const corePackage of Object.entries(corePackages)) {
            if (corePackage[0] === loadedPackage[0] && corePackage[1] === loadedPackage[1]) {
                removeLoadedPackage = false;
                break;
            }
        }

        if (removeLoadedPackage) {
            delete packageJson.packageJson.dependencies[loadedPackage[0]];
        }
    }

    await writePkg(`./dist/packages/omnihive`, packageJson.packageJson);
    console.log(chalk.greenBright("Done removing non-core packages from OmniHive package.json..."));

    console.log(chalk.blue("Done building client and server..."));
    console.log();

    // Handle version maintenance
    console.log(chalk.blue("Version maintenance..."));

    // SemVer Updates
    console.log(chalk.yellow("Getting semver..."));

    let currentVersion: string | null = null;

    switch (args.argv.type) {
        case "prerelease":
            switch (args.argv.channel) {
                case "dev":
                    currentVersion = semver.inc(version.dev, "prerelease", false, "dev") ?? "";

                    if (!currentVersion || currentVersion === "") {
                        console.log(chalk.red("SemVer is incorrect"));
                        process.exit();
                    }

                    version.dev = currentVersion;
                    break;
                case "beta":
                    currentVersion = semver.inc(version.beta, "prerelease", false, "beta") ?? "";

                    if (!currentVersion || currentVersion === "") {
                        console.log(chalk.red("SemVer is incorrect"));
                        process.exit();
                    }

                    version.beta = currentVersion;
                    break;
                default:
                    console.log(chalk.red("Must have dev or beta channel with prerelease"));
                    process.exit();
            }
            break;
        case "major":
            currentVersion = semver.inc(version.main, "major") ?? "";

            if (!currentVersion || currentVersion === "") {
                console.log(chalk.red("SemVer is incorrect"));
                process.exit();
            }

            version.main = currentVersion;
            version.beta = semver.inc(currentVersion, "prerelease", false, "beta") ?? "";
            version.dev = semver.inc(currentVersion, "prerelease", false, "dev") ?? "";
            break;
        case "minor":
            currentVersion = semver.inc(version.main, "minor") ?? "";

            if (!currentVersion || currentVersion === "") {
                console.log(chalk.red("SemVer is incorrect"));
                process.exit();
            }

            version.main = currentVersion;
            version.beta = semver.inc(currentVersion, "prerelease", false, "beta") ?? "";
            version.dev = semver.inc(currentVersion, "prerelease", false, "dev") ?? "";
            break;
        case "patch":
            currentVersion = semver.inc(version.main, "patch") ?? "";

            if (!currentVersion || currentVersion === "") {
                console.log(chalk.red("SemVer is incorrect"));
                process.exit();
            }

            version.main = currentVersion;
            version.beta = semver.inc(currentVersion, "prerelease", false, "beta") ?? "";
            version.dev = semver.inc(currentVersion, "prerelease", false, "dev") ?? "";
            break;
    }

    console.log(chalk.greenBright(`Done getting semver ${currentVersion}...`));

    // Patch package.json with SemVer
    console.log(chalk.yellow("Patching package.json files..."));

    const replaceWorkspaceOptions: ReplaceInFileConfig = {
        allowEmptyPaths: true,
        files: ["dist/packages/**/package.json"],
        from: /workspace:\*/g,
        to: `${currentVersion}`,
    };

    await replaceInFile.replaceInFile(replaceWorkspaceOptions);

    const replaceVersionOptions: ReplaceInFileConfig = {
        allowEmptyPaths: true,
        files: ["dist/packages/**/package.json"],
        from: /"version": "0.0.1"/g,
        to: `"version": "${currentVersion}"`,
    };

    await replaceInFile.replaceInFile(replaceVersionOptions);

    console.log(chalk.greenBright("Done patching package.json files..."));

    // Upate Elastic with new version
    console.log(chalk.yellow("Updating version metadata..."));

    await elasticClient.update({ index: "master-version", id: "1", body: { doc: version } });

    console.log(chalk.greenBright("Done updating version metadata..."));

    // Tag Github branch with version
    console.log(chalk.yellow("Tagging GitHub..."));

    execSpawn(`git tag ${currentVersion}`, "./");

    console.log(chalk.greenBright("Done tagging GitHub..."));

    // Finish version maintenance
    console.log(chalk.blue("Done with version maintenance..."));
    console.log();

    // Check for publish flag and start publish if there
    if (!args.argv.publish as boolean) {
        console.log(chalk.redBright("Publish not specified...skipping"));
    } else {
        // Publish core libraries
        console.log(chalk.blue("Publishing core libraries..."));

        directories
            .filter((value: string) => value === "omnihive-core")
            .forEach((value: string) => {
                console.log(chalk.yellow(`Publishing ${value}...`));
                execSpawn("npm publish --access public", `./dist/packages/${value}`);
                console.log(chalk.greenBright(`Done publishing ${value}...`));
            });

        directories
            .filter((value: string) => value === "omnihive-core-node")
            .forEach((value: string) => {
                console.log(chalk.yellow(`Publishing ${value}...`));
                execSpawn("npm publish --access public", `./dist/packages/${value}`);
                console.log(chalk.greenBright(`Done publishing ${value}...`));
            });

        console.log(chalk.blue("Done publishing core libraries..."));
        console.log();

        // Publish workers
        console.log(chalk.blue("Publishing workers..."));

        directories
            .filter((value: string) => value.startsWith("omnihive-worker"))
            .forEach((value: string) => {
                console.log(chalk.yellow(`Publishing ${value}...`));
                execSpawn("npm publish --access public", `./dist/packages/${value}`);
                console.log(chalk.greenBright(`Done publishing ${value}...`));
            });

        console.log(chalk.blue("Done publishing workers..."));
        console.log();

        // Publish client and server
        console.log(chalk.blue("Publishing client and server..."));

        directories
            .filter((value: string) => value === "omnihive-client")
            .forEach((value: string) => {
                console.log(chalk.yellow(`Publishing ${value}...`));
                execSpawn("npm publish --access public", `./dist/packages/${value}`);
                console.log(chalk.greenBright(`Done publishing ${value}...`));
            });

        directories
            .filter((value: string) => value === "omnihive")
            .forEach((value: string) => {
                console.log(chalk.yellow(`Publishing ${value}...`));
                execSpawn("npm publish --access public", `./dist/packages/${value}`);
                console.log(chalk.greenBright(`Done publishing ${value}...`));
            });

        console.log(chalk.blue("Done publishing client server..."));
    }

    // Close out
    console.log();
    console.log(chalk.hex("#FFC022#")("Done building OmniHive monorepo..."));
    console.log();
    process.exit();
};

const execSpawn = (commandString: string, cwd: string): string => {
    const execSpawn = childProcess.spawnSync(commandString, {
        shell: true,
        cwd,
        stdio: ["inherit", "pipe", "pipe"],
    });

    if (execSpawn.status !== 0) {
        const execError: Error = new Error(execSpawn.stderr.toString().trim());
        console.log(chalk.red(execError));
        process.exit();
    }

    const execOut = execSpawn.stdout.toString().trim();

    if (execOut && execOut !== "") {
        return execOut;
    } else {
        return "";
    }
};

build();
