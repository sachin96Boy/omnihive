import chalk from "chalk";
import childProcess from "child_process";
import dayjs from "dayjs";
import figlet from "figlet";
import fse from "fs-extra";
import path from "path";
import readPkgUp from "read-pkg-up";
import replaceInFile, { ReplaceInFileConfig } from "replace-in-file";
import writePkg from "write-pkg";
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
            demandCommand: true,
            description: "Version number to build",
            default: "99.99.99",
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
            default: "latest",
            description: "Tag to use when publishing",
        })
        .check((args) => {
            if ((args.publishAccess || args.publishTag) && !args.publish) {
                throw new Error("If you provide an access or tag for publishing please specify the publish flag");
            }
        }).argv;

    // Header
    console.log(chalk.yellow(figlet.textSync("OMNIHIVE")));
    console.log(chalk.hex(orangeHex)("Building OmniHive monorepo..."));
    console.log();

    // Clear out existing dist directory
    console.log(chalk.yellow("Clearing existing dist directory..."));
    fse.rmSync(path.join(`.`, `dist`), { recursive: true, force: true });
    console.log(chalk.greenBright("Done clearing existing dist directory..."));

    // Get all packages directories
    const directories: string[] = fse
        .readdirSync(path.join(`.`, `src`, `packages`))
        .filter((f) => fse.statSync(path.join(`.`, `src`, `packages`, f)).isDirectory());

    // Build core libraries
    console.log();
    console.log(chalk.blue("Building core libraries..."));

    directories
        .filter((value: string) => value === "omnihive-core")
        .forEach((value: string) => {
            console.log(chalk.yellow(`Building ${value}...`));
            execSpawn("yarn run build", path.join(`.`, `src`, `packages`, `${value}`));
            fse.copySync(
                path.join(`.`, `src`, `packages`, `${value}`, `package.json`),
                path.join(`.`, `dist`, `packages`, `${value}`, `package.json`)
            );
            execSpawn("yarn pack", path.join(`.`, `dist`, `packages`, `${value}`));
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
            execSpawn("yarn run build", path.join(`.`, `src`, `packages`, `${value}`));
            fse.copySync(
                path.join(`.`, `src`, `packages`, `${value}`, `package.json`),
                path.join(`.`, `dist`, `packages`, `${value}`, `package.json`)
            );
            execSpawn("yarn pack", path.join(`.`, `dist`, `packages`, `${value}`));
            console.log(chalk.greenBright(`Done building ${value}...`));
        });

    console.log(chalk.blue("Done building workers..."));
    console.log();

    // Build client and server
    console.log(chalk.blue("Building client and server..."));

    directories
        .filter((value: string) => value === "omnihive-client")
        .forEach((value: string) => {
            console.log(chalk.yellow(`Building ${value}...`));
            execSpawn("yarn run build", path.join(`.`, `src`, `packages`, `${value}`));
            fse.copySync(
                path.join(`.`, `src`, `packages`, `${value}`, `package.json`),
                path.join(`.`, `dist`, `packages`, `${value}`, `package.json`)
            );
            execSpawn("yarn pack", path.join(`.`, `dist`, `packages`, `${value}`));
            console.log(chalk.greenBright(`Done building ${value}...`));
        });

    directories
        .filter((value: string) => value === "omnihive")
        .forEach((value: string) => {
            console.log(chalk.yellow(`Building main server package ${value}...`));
            execSpawn("yarn run build", path.join(`.`, `src`, `packages`, `${value}`));
            fse.copySync(
                path.join(`.`, `src`, `packages`, `${value}`, `package.json`),
                path.join(`.`, `dist`, `packages`, `${value}`, `package.json`)
            );
            execSpawn("yarn pack", path.join(`.`, `dist`, `packages`, `${value}`));
            console.log(chalk.greenBright(`Done building main server package ${value}...`));
        });

    //Copy over miscellaneous files (npmignore, pug, etc.)
    console.log(chalk.yellow("Copying miscellaneous OmniHive files..."));

    const miscFiles = [".npmignore", `postcss.config.js`, `tailwind.config.js`];

    miscFiles.forEach((value: string) => {
        fse.copyFileSync(
            path.join(`.`, `src`, `packages`, `omnihive`, `${value}`),
            path.join(`.`, `dist`, `packages`, `omnihive`, `${value}`)
        );
    });

    const miscFolders = [path.join(`app`, `public`), path.join(`app`, `views`), "templates"];

    miscFolders.forEach((value: string) => {
        fse.copySync(
            path.join(`.`, `src`, `packages`, `omnihive`, `${value}`),
            path.join(`.`, `dist`, `packages`, `omnihive`, `${value}`)
        );
    });

    console.log(chalk.greenBright("Done copying miscellaneous OmniHive files..."));

    //Remove non-core packages from package.json in server
    console.log(chalk.yellow("Removing non-core packages from OmniHive package.json..."));

    const packageJson: readPkgUp.NormalizedReadResult | undefined = await readPkgUp({
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

    console.log(chalk.greenBright("Done removing non-core packages from OmniHive package.json..."));

    console.log(chalk.blue("Done building client and server..."));
    console.log();

    // Handle version maintenance
    console.log(chalk.blue("Version maintenance..."));

    // Patch package.json with SemVer
    console.log(chalk.yellow("Patching package.json files..."));

    const replaceWorkspaceOptions: ReplaceInFileConfig = {
        allowEmptyPaths: true,
        files: [path.join(`dist`, `packages`, `**`, `package.json`)],
        from: /workspace:\*/g,
        to: `${args.argv.version}`,
    };

    await replaceInFile.replaceInFile(replaceWorkspaceOptions);

    const replaceVersionOptions: ReplaceInFileConfig = {
        allowEmptyPaths: true,
        files: [path.join(`dist`, `packages`, `**`, `package.json`)],
        from: /"version": "0.0.1"/g,
        to: `"version": "${args.argv.version}"`,
    };

    await replaceInFile.replaceInFile(replaceVersionOptions);

    console.log(chalk.greenBright("Done patching package.json files..."));

    // Tag Github branch with version
    if (!args.argv.publish as boolean) {
        console.log(chalk.redBright("Publish not specified...skipping Git tagging"));
    } else {
        console.log(chalk.yellow("Tagging GitHub..."));

        execSpawn(`git tag ${args.argv.version}`, ".");

        console.log(chalk.greenBright("Done tagging GitHub..."));
    }

    // Finish version maintenance
    console.log(chalk.blue("Done with version maintenance..."));
    console.log();

    // Check for publish flag and start publish if there
    if (!args.argv.publish as boolean) {
        console.log(chalk.redBright("Publish not specified...skipping npm publish"));
    } else {
        let publishString: string = "yarn npm publish";

        if (args.argv.publishAccess) {
            publishString = `${publishString} --access ${args.argv.publishAccess as string}`;
        } else {
            publishString = `${publishString} --access public`;
        }

        if (args.argv.publishTag) {
            publishString = `${publishString} --tag ${args.argv.publishTag as string}`;
        }

        // Publish core libraries
        console.log(chalk.blue("Publishing core libraries..."));

        directories
            .filter((value: string) => value === "omnihive-core")
            .forEach((value: string) => {
                console.log(chalk.yellow(`Publishing ${value}...`));
                execSpawn("npm publish --access public", path.join(`.`, `dist`, `packages`, `${value}`));
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
                execSpawn("npm publish --access public", path.join(`.`, `dist`, `packages`, `${value}`));
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
                execSpawn("npm publish --access public", path.join(`.`, `dist`, `packages`, `${value}`));
                console.log(chalk.greenBright(`Done publishing ${value}...`));
            });

        directories
            .filter((value: string) => value === "omnihive")
            .forEach((value: string) => {
                console.log(chalk.yellow(`Publishing ${value}...`));
                execSpawn("npm publish --access public", path.join(`.`, `dist`, `packages`, `${value}`));
                console.log(chalk.greenBright(`Done publishing ${value}...`));
            });

        console.log(chalk.blue("Done publishing client server..."));
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
