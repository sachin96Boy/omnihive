/// <reference path="../../../types/globals.omnihive.d.ts" />

import { OmniHiveLogLevel } from "@withonevision/omnihive-core/enums/OmniHiveLogLevel";
import { StringBuilder } from "@withonevision/omnihive-core/helpers/StringBuilder";
import { HiveWorker } from "@withonevision/omnihive-core/models/HiveWorker";
import childProcess from "child_process";
import readPkgUp, { NormalizedReadResult } from "read-pkg-up";
import { RegisteredHiveWorker } from "@withonevision/omnihive-core/models/RegisteredHiveWorker";
import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { ILogWorker } from "@withonevision/omnihive-core/interfaces/ILogWorker";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { CommandLineArgs } from "../models/CommandLineArgs";
import { GlobalObject } from "../models/GlobalObject";
import fse from "fs-extra";
import dotenv from "dotenv";
import path from "path";
import { StringHelper } from "@withonevision/omnihive-core/helpers/StringHelper";
import chalk from "chalk";
import yaml from "yaml";
import { IConfigWorker } from "@withonevision/omnihive-core/interfaces/IConfigWorker";
import figlet from "figlet";

export class CommonService {
    public bootLoader = async (rootDir: string, commandLineArgs: CommandLineArgs) => {
        console.log(chalk.yellow(figlet.textSync("OMNIHIVE")));
        console.log();

        global.omnihive = new GlobalObject();
        global.omnihive.ohDirName = rootDir;
        global.omnihive.commandLineArgs = commandLineArgs;

        let bootLoaderType: string = "json";

        if (commandLineArgs.environmentFile && fse.existsSync(commandLineArgs.environmentFile)) {
            dotenv.config({ path: commandLineArgs.environmentFile });
        }

        if (commandLineArgs.environmentFile && !fse.existsSync(commandLineArgs.environmentFile)) {
            if (fse.existsSync(path.join(global.omnihive.ohDirName, commandLineArgs.environmentFile))) {
                dotenv.config({
                    path: path.join(global.omnihive.ohDirName, commandLineArgs.environmentFile),
                });
            }
        }

        if (
            !process.env.OMNIHIVE_BOOT_LOADER_TYPE ||
            StringHelper.isNullOrWhiteSpace(process.env.OMNIHIVE_BOOT_LOADER_TYPE) ||
            (process.env.OMNIHIVE_BOOT_LOADER_TYPE?.toLowerCase() !== "json" &&
                process.env.OMNIHIVE_BOOT_LOADER_TYPE?.toLowerCase() !== "yaml")
        ) {
            chalk.yellow("No valid boot loader type provided...assuming JSON");
        } else {
            bootLoaderType = process.env.OMNIHIVE_BOOT_LOADER_TYPE;
        }

        if (
            !process.env.OMNIHIVE_BOOT_LOADER_LOCATION ||
            StringHelper.isNullOrWhiteSpace(process.env.OMNIHIVE_BOOT_LOADER_LOCATION) ||
            (!fse.existsSync(process.env.OMNIHIVE_BOOT_LOADER_LOCATION) &&
                !fse.existsSync(
                    path.join(
                        path.parse(global.omnihive.commandLineArgs.environmentFile).dir,
                        process.env.OMNIHIVE_BOOT_LOADER_LOCATION
                    )
                ) &&
                !fse.existsSync(path.join(global.omnihive.ohDirName, process.env.OMNIHIVE_BOOT_LOADER_LOCATION)))
        ) {
            throw new Error("No Valid Boot Loader Location Given...OmniHive Cannot Continue");
        }

        let bootLoaderFile: string = "";

        try {
            if (fse.existsSync(process.env.OMNIHIVE_BOOT_LOADER_LOCATION)) {
                bootLoaderFile = fse.readFileSync(process.env.OMNIHIVE_BOOT_LOADER_LOCATION, "utf8");
            }

            if (
                fse.existsSync(
                    path.join(
                        path.parse(global.omnihive.commandLineArgs.environmentFile).dir,
                        process.env.OMNIHIVE_BOOT_LOADER_LOCATION
                    )
                )
            ) {
                bootLoaderFile = fse.readFileSync(
                    path.join(
                        path.parse(global.omnihive.commandLineArgs.environmentFile).dir,
                        process.env.OMNIHIVE_BOOT_LOADER_LOCATION
                    ),
                    "utf8"
                );
            }

            if (fse.existsSync(path.join(global.omnihive.ohDirName, process.env.OMNIHIVE_BOOT_LOADER_LOCATION))) {
                bootLoaderFile = fse.readFileSync(
                    path.join(global.omnihive.ohDirName, process.env.OMNIHIVE_BOOT_LOADER_LOCATION),
                    "utf8"
                );
            }

            switch (bootLoaderType.toLowerCase()) {
                case "json":
                    global.omnihive.bootLoaderSettings = JSON.parse(bootLoaderFile);
                    break;
                case "yaml":
                    global.omnihive.bootLoaderSettings = yaml.parse(bootLoaderFile);
                    break;
                default:
                    global.omnihive.bootLoaderSettings = JSON.parse(bootLoaderFile);
                    break;
            }
        } catch {
            throw new Error("No Valid Boot Loader Location Given...OmniHive Cannot Continue");
        }

        await global.omnihive.pushWorker(global.omnihive.bootLoaderSettings.configWorker, true, false);
        global.omnihive.bootWorkerNames.push(global.omnihive.bootLoaderSettings.configWorker.name);
        global.omnihive.serverSettings.workers.push(global.omnihive.bootLoaderSettings.configWorker);

        const pkgJson: NormalizedReadResult | undefined = await AwaitHelper.execute(readPkgUp());

        // Load Boot Workers
        if (
            pkgJson &&
            pkgJson.packageJson &&
            pkgJson.packageJson.omniHive &&
            pkgJson.packageJson.omniHive.bootWorkers
        ) {
            const bootWorkers: HiveWorker[] = pkgJson.packageJson.omniHive.bootWorkers as HiveWorker[];

            for (const bootWorker of bootWorkers) {
                if (
                    !global.omnihive.registeredWorkers.some((rw: RegisteredHiveWorker) => rw.name === bootWorker.name)
                ) {
                    await AwaitHelper.execute(global.omnihive.pushWorker(bootWorker, true, false));
                    global.omnihive.bootWorkerNames.push(bootWorker.name);
                    global.omnihive.serverSettings.workers.push(bootWorker);
                }
            }
        }

        const configWorker: IConfigWorker | undefined = global.omnihive.getWorker<IConfigWorker>(HiveWorkerType.Config);

        if (!configWorker) {
            throw new Error("No config worker can be found.  OmniHive cannot load.");
        }

        global.omnihive.serverSettings = await AwaitHelper.execute(configWorker.get());
    };

    public workerLoader = async () => {
        const pkgJson: NormalizedReadResult | undefined = await AwaitHelper.execute(readPkgUp());

        const logWorker: ILogWorker | undefined = global.omnihive.getWorker<ILogWorker>(
            HiveWorkerType.Log,
            "ohBootLogWorker"
        );

        // Load Core Workers
        if (
            pkgJson &&
            pkgJson.packageJson &&
            pkgJson.packageJson.omniHive &&
            pkgJson.packageJson.omniHive.coreWorkers
        ) {
            const coreWorkers: HiveWorker[] = pkgJson.packageJson.omniHive.coreWorkers as HiveWorker[];

            for (const coreWorker of coreWorkers) {
                if (
                    !global.omnihive.registeredWorkers.some((rw: RegisteredHiveWorker) => rw.name === coreWorker.name)
                ) {
                    await AwaitHelper.execute(global.omnihive.pushWorker(coreWorker, false, true));
                    global.omnihive.serverSettings.workers.push(coreWorker);
                }
            }
        }

        // Load Workers
        logWorker?.write(OmniHiveLogLevel.Info, `Registering default workers from package.json...`);

        // Load Default Workers
        if (
            pkgJson &&
            pkgJson.packageJson &&
            pkgJson.packageJson.omniHive &&
            pkgJson.packageJson.omniHive.defaultWorkers
        ) {
            const defaultWorkers: HiveWorker[] = pkgJson.packageJson.omniHive.defaultWorkers as HiveWorker[];

            defaultWorkers.forEach((defaultWorker: HiveWorker) => {
                if (
                    !global.omnihive.serverSettings.workers.some(
                        (hiveWorker: HiveWorker) => hiveWorker.type === defaultWorker.type
                    )
                ) {
                    global.omnihive.serverSettings.workers.push(defaultWorker);
                }
            });
        }

        logWorker?.write(OmniHiveLogLevel.Info, `Working on hive worker packages...`);

        if (
            pkgJson &&
            pkgJson.packageJson &&
            pkgJson.packageJson.dependencies &&
            pkgJson.packageJson.omniHive &&
            pkgJson.packageJson.omniHive.coreDependencies
        ) {
            // Build lists
            const corePackages: any = pkgJson.packageJson.omniHive.coreDependencies;
            const loadedPackages: any = pkgJson.packageJson.dependencies;
            const workerPackages: any = {};

            global.omnihive.serverSettings.workers.forEach((hiveWorker: HiveWorker) => {
                if (
                    hiveWorker.package &&
                    hiveWorker.package !== "" &&
                    hiveWorker.version &&
                    hiveWorker.version !== ""
                ) {
                    workerPackages[hiveWorker.package] = hiveWorker.version;
                }
            });

            //Find out what to remove
            const packagesToRemove: string[] = [];

            for (const loadedPackage of Object.entries(loadedPackages)) {
                let removeLoadedPackage: boolean = true;

                for (const corePackage of Object.entries(corePackages)) {
                    if (corePackage[0] === loadedPackage[0] && corePackage[1] === loadedPackage[1]) {
                        removeLoadedPackage = false;
                        break;
                    }
                }

                if (removeLoadedPackage) {
                    for (const workerPackage of Object.entries(workerPackages)) {
                        if (workerPackage[0] === loadedPackage[0] && workerPackage[1] === loadedPackage[1]) {
                            removeLoadedPackage = false;
                            break;
                        }
                    }
                }

                if (removeLoadedPackage) {
                    packagesToRemove.push(loadedPackage[0]);
                }
            }

            if (packagesToRemove.length === 0) {
                logWorker?.write(OmniHiveLogLevel.Info, `No Custom Packages to Uninstall...Moving On`);
            } else {
                logWorker?.write(OmniHiveLogLevel.Info, `Removing ${packagesToRemove.length} Custom Package(s)`);
                const removeCommand = new StringBuilder();
                removeCommand.append("yarn remove ");

                packagesToRemove.forEach((packageName: string, index: number) => {
                    logWorker?.write(OmniHiveLogLevel.Info, `Removing ${packageName} As a Custom Package(s)`);
                    removeCommand.append(packageName);

                    if (index < packagesToRemove.length - 1) {
                        removeCommand.append(" ");
                    }
                });

                const removeSpawn = childProcess.spawnSync(removeCommand.outputString(), {
                    shell: true,
                    cwd: global.omnihive.ohDirName,
                    stdio: ["inherit", "pipe", "pipe"],
                });

                if (removeSpawn.status !== 0) {
                    const removeError: Error = new Error(removeSpawn.stderr.toString().trim());
                    logWorker?.write(OmniHiveLogLevel.Error, removeSpawn.stderr.toString().trim());
                    throw removeError;
                }
            }

            //Find out what to add
            const packagesToAdd: string[] = [];

            for (const workerPackage of Object.entries(workerPackages)) {
                let addWorkerPackage: boolean = true;

                for (const loadedPackage of Object.entries(loadedPackages)) {
                    if (workerPackage[0] === loadedPackage[0] && workerPackage[1] === loadedPackage[1]) {
                        addWorkerPackage = false;
                        break;
                    }
                }

                if (addWorkerPackage) {
                    packagesToAdd.push(`${workerPackage[0]}@${workerPackage[1]}`);
                }
            }

            if (packagesToAdd.length === 0) {
                logWorker?.write(OmniHiveLogLevel.Info, `No Custom Packages to Add...Moving On`);
            } else {
                logWorker?.write(OmniHiveLogLevel.Info, `Adding ${packagesToAdd.length} Custom Package(s)`);
                const addCommand = new StringBuilder();
                addCommand.append("yarn add ");

                packagesToAdd.forEach((packageName: string, index: number) => {
                    logWorker?.write(OmniHiveLogLevel.Info, `Adding ${packageName} As a Custom Package(s)`);
                    addCommand.append(packageName);

                    if (index < packagesToAdd.length - 1) {
                        addCommand.append(" ");
                    }
                });

                const addSpawn = childProcess.spawnSync(addCommand.outputString(), {
                    shell: true,
                    cwd: global.omnihive.ohDirName,
                    stdio: ["inherit", "pipe", "pipe"],
                });

                if (addSpawn.status !== 0) {
                    const addError: Error = new Error(addSpawn.stderr.toString().trim());
                    logWorker?.write(OmniHiveLogLevel.Error, addSpawn.stderr.toString().trim());
                    throw addError;
                }
            }
        }

        logWorker?.write(OmniHiveLogLevel.Info, "Custom packages complete");

        // Register hive workers
        logWorker?.write(OmniHiveLogLevel.Info, "Working on hive workers...");
        await AwaitHelper.execute(global.omnihive.initWorkers(global.omnihive.serverSettings.workers));
        logWorker?.write(OmniHiveLogLevel.Info, "Hive Workers Initiated...");
    };
}
