import { copyFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import spawn from "cross-spawn";
import figlet from "figlet";
import chalk from "chalk";

const build = async (): Promise<void> => {
    console.log(chalk.yellow(figlet.textSync("OMNIHIVE")));
    console.log();
    console.log(chalk.hex("#FFC022#")("Building OmniHive monorepo..."));
    console.log();
    console.log(chalk.blue("Building common libraries..."));

    const directories: string[] = getPackageDirectories("./src/packages");

    directories
        .filter((value: string) => value.startsWith("omnihive-common"))
        .forEach((value: string) => {
            console.log(chalk.yellow(`Building ${value}...`));

            spawn.sync("yarn run build", {
                shell: true,
                cwd: `./src/packages/${value}`,
            });

            console.log(chalk.greenBright(`Done building ${value}...`));
        });

    console.log(chalk.blue("Done building common libraries..."));
    console.log();
    console.log(chalk.blue("Building workers..."));

    directories
        .filter((value: string) => value.startsWith("omnihive-worker"))
        .forEach((value: string) => {
            console.log(chalk.yellow(`Building ${value}...`));

            spawn.sync("yarn run build", {
                shell: true,
                cwd: `./src/packages/${value}`,
            });

            console.log(chalk.greenBright(`Done building ${value}...`));
        });

    console.log(chalk.blue("Done building workers..."));
    console.log();
    console.log(chalk.blue("Building server..."));
    console.log(chalk.yellow("Building main server package..."));

    directories
        .filter((value: string) => value === "omnihive")
        .forEach((value: string) => {
            spawn.sync("yarn run build", {
                shell: true,
                cwd: `./src/packages/${value}`,
            });
        });

    console.log(chalk.greenBright(`Done building main server package...`));
    console.log(chalk.yellow("Copying NextJS OmniHive files..."));

    nextJsFiles.forEach((value: string) => {
        copyFileSync(`./src/packages/omnihive/${value}`, `./dist/packages/omnihive/${value}`);
    });

    console.log(chalk.greenBright("Done copying NextJS OmniHive files..."));

    /*
    console.log("Building NextJS server...");

    spawn.sync("next build", {
        shell: true,
        cwd: `./dist/packages/omnihive`,
    });

    console.log("Done building NextJS server...");
    */

    console.log(chalk.blue("Done building server..."));
    console.log();
    console.log(chalk.hex("#FFC022#")("Done building OmniHive monorepo.."));
    console.log();
};

const getPackageDirectories = (startDirectory: string): string[] => {
    return readdirSync(startDirectory).filter((f) => statSync(join(startDirectory, f)).isDirectory());
};

const nextJsFiles = ["next-env.d.ts", "next.config.js", "postcss.config.js", "tailwind.config.js"];

build();
