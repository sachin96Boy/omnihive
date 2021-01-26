import chalk from "chalk";
import childProcess from "child_process";
import clear from "clear";
import figlet from "figlet";
import { copyFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import replaceInFile, { ReplaceInFileConfig } from "replace-in-file";
import { serializeError } from "serialize-error";
import yargs from "yargs";
import version from "./version.json";
import semver from "semver";
import fs from "fs";

const build = async (): Promise<void> => {
    const args = yargs(process.argv.slice(2));

    clear();

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
            if (args.channel === "main" && args.type === "prerelease") {
                throw new Error(
                    "You cannot specify a main release channel and specify prerelease.  Prerelease is for dev and beta channels only."
                );
            }

            if (
                (args.channel === "dev" || args.channel === "beta") &&
                (args.type === "major" || args.type === "minor" || args.type === "patch")
            ) {
                throw new Error(
                    "You cannot specify a prerelease channel and specify a main release type.  Prerelease is the only option for dev or beta"
                );
            }
            return true;
        }).argv;

    console.log(chalk.yellow(figlet.textSync("OMNIHIVE")));
    console.log(chalk.hex("#FFC022")("Building OmniHive monorepo..."));
    console.log();
    console.log(chalk.yellow("Clearing existing dist directory..."));

    fs.rmSync("./dist", { recursive: true, force: true });

    console.log();
    console.log(chalk.blue("Building core libraries..."));

    const directories: string[] = readdirSync("./src/packages").filter((f) =>
        statSync(join("./src/packages", f)).isDirectory()
    );

    directories
        .filter((value: string) => value.startsWith("omnihive-core"))
        .forEach((value: string) => {
            console.log(chalk.yellow(`Building ${value}...`));

            const coreSpawn = childProcess.spawnSync("yarn run build", {
                shell: true,
                cwd: `./src/packages/${value}`,
                stdio: ["inherit", "inherit", "pipe"],
            });

            if (coreSpawn.status !== 0) {
                const coreError: Error = new Error(serializeError(coreSpawn.stderr.toString()));
                console.log(chalk.red(coreError));
                process.exit();
            }

            console.log(chalk.greenBright(`Done building ${value}...`));
        });

    console.log(chalk.blue("Done building core libraries..."));
    console.log();
    console.log(chalk.blue("Building workers..."));

    directories
        .filter((value: string) => value.startsWith("omnihive-worker"))
        .forEach((value: string) => {
            console.log(chalk.yellow(`Building ${value}...`));

            const workerSpawn = childProcess.spawnSync("yarn run build", {
                shell: true,
                cwd: `./src/packages/${value}`,
                stdio: ["inherit", "inherit", "pipe"],
            });

            if (workerSpawn.status !== 0) {
                const workerError: Error = new Error(serializeError(workerSpawn.stderr.toString()));
                console.log(chalk.red(workerError));
                process.exit();
            }

            console.log(chalk.greenBright(`Done building ${value}...`));
        });

    console.log(chalk.blue("Done building workers..."));
    console.log();
    console.log(chalk.blue("Building server..."));
    console.log(chalk.yellow("Building main server package..."));

    directories
        .filter((value: string) => value === "omnihive")
        .forEach((value: string) => {
            const serverSwawn = childProcess.spawnSync("yarn run build", {
                shell: true,
                cwd: `./src/packages/${value}`,
                stdio: ["inherit", "inherit", "pipe"],
            });

            if (serverSwawn.status !== 0) {
                const serverError: Error = new Error(serializeError(serverSwawn.stderr.toString()));
                console.log(chalk.red(serverError));
                process.exit();
            }
        });

    console.log(chalk.greenBright(`Done building main server package...`));
    console.log(chalk.yellow("Copying NextJS OmniHive files..."));

    const nextJsFiles = ["next-env.d.ts", "next.config.js", "postcss.config.js", "tailwind.config.js"];

    nextJsFiles.forEach((value: string) => {
        copyFileSync(`./src/packages/omnihive/${value}`, `./dist/packages/omnihive/${value}`);
    });

    console.log(chalk.greenBright("Done copying NextJS OmniHive files..."));

    console.log(chalk.blue("Done building server..."));
    console.log();
    console.log(chalk.blue("Cleanup..."));
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
    console.log(chalk.yellow("Updating version file..."));

    fs.writeFileSync("./version.json", JSON.stringify(version));

    console.log(chalk.greenBright("Done patching version file..."));
    console.log(chalk.yellow("Bumping GitHub version..."));

    const gitAddSpawn = childProcess.spawnSync("git add version.json", {
        shell: true,
        cwd: `./`,
        stdio: ["inherit", "inherit", "pipe"],
    });

    if (gitAddSpawn.status !== 0) {
        const gitAddError: Error = new Error(serializeError(gitAddSpawn.stderr.toString()));
        console.log(chalk.red(gitAddError));
        process.exit();
    }

    const gitCommitSpawn = childProcess.spawnSync(`git commit -m "Bump ${args.argv.channel} to ${currentVersion}"`, {
        shell: true,
        cwd: `./`,
        stdio: ["inherit", "inherit", "pipe"],
    });

    if (gitCommitSpawn.status !== 0) {
        const gitCommitError: Error = new Error(serializeError(gitCommitSpawn.stderr.toString()));
        console.log(chalk.red(gitCommitError));
        process.exit();
    }

    console.log(chalk.greenBright("Done bumping GitHub version..."));
    console.log(chalk.blue("Done with cleanup..."));
    console.log();
    console.log(chalk.hex("#FFC022#")("Done building OmniHive monorepo..."));
    console.log();
    process.exit();
};

build();
