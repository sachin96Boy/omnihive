import { OmniHiveLogLevel } from "@withonevision/omnihive-hive-common/enums/OmniHiveLogLevel";
import { StringBuilder } from "@withonevision/omnihive-hive-common/helpers/StringBuilder";
import { HiveWorker } from "@withonevision/omnihive-hive-common/models/HiveWorker";
import { SystemSettings } from "@withonevision/omnihive-hive-common/models/SystemSettings";
import { QueenStore } from "../stores/QueenStore";
import spawn from "cross-spawn";
import { NormalizedReadResult } from "read-pkg-up";
import fse from "fs-extra";
import { HiveWorkerFactory } from "@withonevision/omnihive-hive-worker/HiveWorkerFactory";
import { LogService } from "./LogService";
import { StringHelper } from "@withonevision/omnihive-hive-common/helpers/StringHelper";
import { HiveWorkerType } from "@withonevision/omnihive-hive-common/enums/HiveWorkerType";
import { IHiveAccountWorker } from "@withonevision/omnihive-hive-worker/interfaces/IHiveAccountWorker";

export class AppService {

    public init = async (settingsPath: string | undefined, packageJson: NormalizedReadResult | undefined): Promise<void> => {

        if (!settingsPath || StringHelper.isNullOrWhiteSpace(settingsPath)) {
            throw new Error("Settings path must be given to init function");
        }

        if (!packageJson) {
            throw new Error("Package.json must be given to load packages");
        }

        // Get Server Settings
        LogService.getInstance().write(OmniHiveLogLevel.Info, `Getting server settings...`);

        const settingsJson: SystemSettings = JSON.parse(fse.readFileSync(`${settingsPath}`, { encoding: "utf8" }));
        QueenStore.getInstance().settings = settingsJson;

        // Load Workers
        LogService.getInstance().write(OmniHiveLogLevel.Info, `Registering default workers from package.json...`);

        // Load Default Workers
        if (packageJson && packageJson.packageJson && packageJson.packageJson.omniHive && packageJson.packageJson.omniHive.defaultWorkers) {
            const defaultWorkers: HiveWorker[] = packageJson.packageJson.omniHive.defaultWorkers as HiveWorker[];

            defaultWorkers.forEach((defaultWorker: HiveWorker) => {

                if (!QueenStore.getInstance().settings.workers.some((hiveWorker: HiveWorker) => hiveWorker.type === defaultWorker.type)) {
                    Object.keys(defaultWorker.metadata).forEach((metaKey: string) => {
                        if (typeof defaultWorker.metadata[metaKey] === "string") {
                            if ((defaultWorker.metadata[metaKey] as string).startsWith("${") && (defaultWorker.metadata[metaKey] as string).endsWith("}")) {
                                let metaValue: string = defaultWorker.metadata[metaKey] as string;

                                metaValue = metaValue.substr(2, metaValue.length - 3);
                                const envValue: string | undefined = process.env[metaValue];

                                if (envValue) {
                                    defaultWorker.metadata[metaKey] = envValue;
                                }
                            }
                        }
                    });

                    QueenStore.getInstance().settings.workers.push(defaultWorker);
                }

            });
        }

        // Load Required Workers
        if (packageJson && packageJson.packageJson && packageJson.packageJson.omniHive && packageJson.packageJson.omniHive.requiredWorkers) {
            const requiredWorkers: HiveWorker[] = packageJson.packageJson.omniHive.requiredWorkers as HiveWorker[];

            requiredWorkers.forEach((requiredWorker: HiveWorker) => {

                if (!QueenStore.getInstance().settings.workers.some((hiveWorker: HiveWorker) => hiveWorker.name === requiredWorker.name)) {
                    Object.keys(requiredWorker.metadata).forEach((metaKey: string) => {
                        if (typeof requiredWorker.metadata[metaKey] === "string") {
                            if ((requiredWorker.metadata[metaKey] as string).startsWith("${") && (requiredWorker.metadata[metaKey] as string).endsWith("}")) {
                                let metaValue: string = requiredWorker.metadata[metaKey] as string;

                                metaValue = metaValue.substr(2, metaValue.length - 3);
                                const envValue: string | undefined = process.env[metaValue];

                                if (envValue) {
                                    requiredWorker.metadata[metaKey] = envValue;
                                }
                            }
                        }
                    });

                    QueenStore.getInstance().settings.workers.push(requiredWorker);
                }

            });
        }

        LogService.getInstance().write(OmniHiveLogLevel.Info, `Working on hive worker packages...`);

        if (packageJson && packageJson.packageJson && packageJson.packageJson.dependencies && packageJson.packageJson.omniHive && packageJson.packageJson.omniHive.coreDependencies) {

            // Build lists
            const corePackages: any = packageJson.packageJson.omniHive.coreDependencies;
            const loadedPackages: any = packageJson.packageJson.dependencies;
            const workerPackages: any = {};

            QueenStore.getInstance().settings.workers.forEach((hiveWorker: HiveWorker) => {
                workerPackages[hiveWorker.package] = hiveWorker.version;
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
                LogService.getInstance().write(OmniHiveLogLevel.Info, `No Custom Packages to Uninstall...Moving On`);
            } else {
                LogService.getInstance().write(OmniHiveLogLevel.Info, `Removing ${packagesToRemove.length} Custom Package(s)`);
                const removeCommand = new StringBuilder();
                removeCommand.append("yarn remove ");

                packagesToRemove.forEach((packageName: string, index: number) => {
                    removeCommand.append(packageName);

                    if (index < packagesToRemove.length - 1) {
                        removeCommand.append(" ");
                    }
                });

                spawn.sync(removeCommand.outputString(), { shell: true, cwd: process.cwd() });
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
                LogService.getInstance().write(OmniHiveLogLevel.Info, `No Custom Packages to Add...Moving On`);
            } else {
                LogService.getInstance().write(OmniHiveLogLevel.Info, `Adding ${packagesToAdd.length} Custom Package(s)`);
                const addCommand = new StringBuilder();
                addCommand.append("yarn add ");

                packagesToAdd.forEach((packageName: string, index: number) => {
                    addCommand.append(packageName);

                    if (index < packagesToAdd.length - 1) {
                        addCommand.append(" ");
                    }
                });

                spawn.sync(addCommand.outputString(), { shell: true, cwd: process.cwd() });
            }
        }

        LogService.getInstance().write(OmniHiveLogLevel.Debug, "Custom packages complete");

        // Register hive workers
        LogService.getInstance().write(OmniHiveLogLevel.Debug, "Working on hive workers...");
        await HiveWorkerFactory.getInstance().init(QueenStore.getInstance().settings.workers);
        LogService.getInstance().write(OmniHiveLogLevel.Debug, "Hive Workers Initiated...");

        // Get account if hive worker exists
        if (HiveWorkerFactory.getInstance().workers.some((hiveWorker: [HiveWorker, any]) => hiveWorker[0].type === HiveWorkerType.HiveAccount)) {
            const accoutWorker: [HiveWorker, any] | undefined = HiveWorkerFactory.getInstance().workers.find((hiveWorker: [HiveWorker, any]) => hiveWorker[0].type === HiveWorkerType.HiveAccount);

            if (accoutWorker) {
                const accountWorkerInstance: IHiveAccountWorker = accoutWorker[1] as IHiveAccountWorker;
                QueenStore.getInstance().account = await accountWorkerInstance.getHiveAccount();
            }
        }
    }
}