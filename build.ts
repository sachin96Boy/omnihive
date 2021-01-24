import { copyFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import spawn from "cross-spawn";

const build = async (): Promise<void> => {
    const directories: string[] = getPackageDirectories("./src/packages");

    directories
        .filter((value: string) => value.startsWith("omnihive-common"))
        .forEach((value: string) => {
            console.log(`Building ${value}...`);

            spawn.sync("yarn run build", {
                shell: true,
                cwd: `./src/packages/${value}`,
            });

            console.log(`Done building ${value}...`);
        });

    directories
        .filter((value: string) => value.startsWith("omnihive-worker"))
        .forEach((value: string) => {
            console.log(`Building ${value}...`);

            spawn.sync("yarn run build", {
                shell: true,
                cwd: `./src/packages/${value}`,
            });

            console.log(`Done building ${value}...`);
        });

    directories
        .filter((value: string) => value === "omnihive")
        .forEach((value: string) => {
            console.log(`Building ${value}...`);

            spawn.sync("yarn run build", {
                shell: true,
                cwd: `./src/packages/${value}`,
            });

            console.log(`Done building ${value}...`);
        });

    console.log("Copying NextJS OmniHive files...");

    nextJsFiles.forEach((value: string) => {
        copyFileSync(`./src/packages/omnihive/${value}`, `./dist/packages/omnihive/${value}`);
    });

    console.log("Done copying NextJS OmniHive files...");

    console.log("Building NextJS server...");

    spawn.sync("next build", {
        shell: true,
        cwd: `./dist/packages/omnihive`,
    });

    console.log("Done building NextJS server...");
};

const getPackageDirectories = (startDirectory: string): string[] => {
    return readdirSync(startDirectory).filter((f) => statSync(join(startDirectory, f)).isDirectory());
};

const nextJsFiles = ["next-env.d.ts", "next.config.js", "postcss.config.js", "tailwind.config.js"];

build();
