import { copyFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import childProcess from "child_process";
import figlet from "figlet";
import chalk from "chalk";
import { serializeError } from "serialize-error";
import clear from "clear";

const build = async (): Promise<void> => {
    clear();

    console.log(chalk.yellow(figlet.textSync("OMNIHIVE")));
    console.log();
    console.log(chalk.hex("#FFC022#")("Building OmniHive monorepo..."));
    console.log();
    console.log(chalk.blue("Building core libraries..."));

    const directories: string[] = getPackageDirectories("./src/packages");

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
                console.log(coreError);
                throw coreError;
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
                console.log(workerError);
                throw workerError;
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
                console.log(serverError);
                throw serverError;
            }
        });

    console.log(chalk.greenBright(`Done building main server package...`));
    console.log(chalk.yellow("Copying NextJS OmniHive files..."));

    nextJsFiles.forEach((value: string) => {
        copyFileSync(`./src/packages/omnihive/${value}`, `./dist/packages/omnihive/${value}`);
    });

    console.log(chalk.greenBright("Done copying NextJS OmniHive files..."));

    console.log(chalk.blue("Done building server..."));
    console.log();
    console.log(chalk.hex("#FFC022#")("Done building OmniHive monorepo..."));
    console.log();
};

const getPackageDirectories = (startDirectory: string): string[] => {
    return readdirSync(startDirectory).filter((f) => statSync(join(startDirectory, f)).isDirectory());
};

const nextJsFiles = ["next-env.d.ts", "next.config.js", "postcss.config.js", "tailwind.config.js"];

build();
