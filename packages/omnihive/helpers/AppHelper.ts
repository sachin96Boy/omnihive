import { HiveWorkerType } from "@withonevision/omnihive-common/enums/HiveWorkerType";
import { OmniHiveLogLevel } from "@withonevision/omnihive-common/enums/OmniHiveLogLevel";
import { AwaitHelper } from "@withonevision/omnihive-common/helpers/AwaitHelper";
import { ObjectHelper } from "@withonevision/omnihive-common/helpers/ObjectHelper";
import { StringBuilder } from "@withonevision/omnihive-common/helpers/StringBuilder";
import { StringHelper } from "@withonevision/omnihive-common/helpers/StringHelper";
import { IFileSystemWorker } from "@withonevision/omnihive-common/interfaces/IFileSystemWorker";
import { IHiveAccountWorker } from "@withonevision/omnihive-common/interfaces/IHiveAccountWorker";
import { ILogWorker } from "@withonevision/omnihive-common/interfaces/ILogWorker";
import { HiveWorker } from "@withonevision/omnihive-common/models/HiveWorker";
import { ServerSettings } from "@withonevision/omnihive-common/models/ServerSettings";
import { CommonStore } from "@withonevision/omnihive-common/stores/CommonStore";
import Conf from "conf";
import spawn from "cross-spawn";
import fse from "fs-extra";
import readPkgUp, { NormalizedReadResult } from "read-pkg-up";

export class AppHelper {

    public getServerSettings = (name: string | undefined, settings: string | undefined): [string, ServerSettings] => {

        if (name && settings) {
            throw new Error("You cannot provide both an instance name and a settings file to the configuration handler");
        }

        if (!name && settings) {
            const settingsJson = JSON.parse(fse.readFileSync(settings, { encoding: "utf8" }));

            try {
                const serverSettings: ServerSettings = ObjectHelper.createStrict<ServerSettings>(ServerSettings, settingsJson);
                return [settings, serverSettings];
            }
            catch {
                throw new Error("Given settings file cannot be successfully parsed into a ServerSettings object");
            }
        }

        const config = new Conf({ projectName: "omnihive", configName: "omnihive" });
        const configSettingPath = config.get(name ?? "");

        if (!configSettingPath || StringHelper.isNullOrWhiteSpace(configSettingPath as string)) {
            throw new Error("The given instance name has not been registered.  Please use the command line to add a new instance");
        }

        const settingsJson = JSON.parse(fse.readFileSync(configSettingPath as string, { encoding: "utf8" }));

        try {
            const serverSettings: ServerSettings = ObjectHelper.createStrict<ServerSettings>(ServerSettings, settingsJson);
            return [configSettingPath as string, serverSettings];
        }
        catch {
            throw new Error("Given settings file cannot be successfully parsed into a ServerSettings object");
        }
    }

    public initApp = async (serverSettings: ServerSettings) => {

        const packageJson: NormalizedReadResult | undefined = await AwaitHelper.execute<NormalizedReadResult | undefined>(readPkgUp());

        if (!packageJson) {
            throw new Error("Package.json must be given to load packages");
        }

        // Load Core Workers
        if (packageJson && packageJson.packageJson && packageJson.packageJson.omniHive && packageJson.packageJson.omniHive.coreWorkers) {
            const coreWorkers: HiveWorker[] = packageJson.packageJson.omniHive.coreWorkers as HiveWorker[];

            for (const coreWorker of coreWorkers) {
                await CommonStore.getInstance().registerWorker(coreWorker);
                CommonStore.getInstance().settings.workers.push(coreWorker);
            }
        }

        const logWorker: ILogWorker | undefined = await CommonStore.getInstance().getHiveWorker<ILogWorker>(HiveWorkerType.Log, "ohreqLogWorker");

        if (!logWorker) {
            throw new Error("Core Log Worker Not Found.  App worker needs the core log worker ohreqLogWorker");
        }

        const fileSystemWorker: IFileSystemWorker | undefined = await CommonStore.getInstance().getHiveWorker<IFileSystemWorker>(HiveWorkerType.FileSystem, "ohreqFileSystemWorker");

        if (!fileSystemWorker) {
            throw new Error("Core FileSystem Worker Not Found.  App worker needs the core log worker ohreqFileSystemWorker");
        }

        // Get Server Settings

        CommonStore.getInstance().settings = serverSettings;
        logWorker.write(OmniHiveLogLevel.Info, `Server Settings Applied...`);

        // Load Workers
        logWorker.write(OmniHiveLogLevel.Info, `Registering default workers from package.json...`);

        // Load Default Workers
        if (packageJson && packageJson.packageJson && packageJson.packageJson.omniHive && packageJson.packageJson.omniHive.defaultWorkers) {
            const defaultWorkers: HiveWorker[] = packageJson.packageJson.omniHive.defaultWorkers as HiveWorker[];

            defaultWorkers.forEach((defaultWorker: HiveWorker) => {

                if (!CommonStore.getInstance().settings.workers.some((hiveWorker: HiveWorker) => hiveWorker.type === defaultWorker.type)) {

                    let registerWorker: boolean = true;

                    Object.keys(defaultWorker.metadata).forEach((metaKey: string) => {
                        if (typeof defaultWorker.metadata[metaKey] === "string") {
                            if ((defaultWorker.metadata[metaKey] as string).startsWith("${") && (defaultWorker.metadata[metaKey] as string).endsWith("}")) {
                                let metaValue: string = defaultWorker.metadata[metaKey] as string;

                                metaValue = metaValue.substr(2, metaValue.length - 3);
                                const envValue: string | undefined = CommonStore.getInstance().settings.constants[metaValue];

                                if (envValue) {
                                    defaultWorker.metadata[metaKey] = envValue;
                                } else {
                                    registerWorker = false;
                                    logWorker.write(OmniHiveLogLevel.Warn, `Cannot register ${defaultWorker.name}...missing ${metaKey} in constants`);
                                }
                            }
                        }
                    });

                    if (registerWorker) {
                        CommonStore.getInstance().settings.workers.push(defaultWorker);
                    }
                }

            });
        }

        logWorker.write(OmniHiveLogLevel.Info, `Working on hive worker packages...`);

        if (packageJson && packageJson.packageJson && packageJson.packageJson.dependencies && packageJson.packageJson.omniHive && packageJson.packageJson.omniHive.coreDependencies) {

            // Build lists
            const corePackages: any = packageJson.packageJson.omniHive.coreDependencies;
            const loadedPackages: any = packageJson.packageJson.dependencies;
            const workerPackages: any = {};

            CommonStore.getInstance().settings.workers.forEach((hiveWorker: HiveWorker) => {
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
                logWorker.write(OmniHiveLogLevel.Info, `No Custom Packages to Uninstall...Moving On`);
            } else {
                logWorker.write(OmniHiveLogLevel.Info, `Removing ${packagesToRemove.length} Custom Package(s)`);
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
                logWorker.write(OmniHiveLogLevel.Info, `No Custom Packages to Add...Moving On`);
            } else {
                logWorker.write(OmniHiveLogLevel.Info, `Adding ${packagesToAdd.length} Custom Package(s)`);
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

        logWorker.write(OmniHiveLogLevel.Debug, "Custom packages complete");

        // Register hive workers
        logWorker.write(OmniHiveLogLevel.Debug, "Working on hive workers...");
        await CommonStore.getInstance().initWorkers(CommonStore.getInstance().settings.workers);
        logWorker.write(OmniHiveLogLevel.Debug, "Hive Workers Initiated...");

        // Get account if hive worker exists
        if (CommonStore.getInstance().workers.some((hiveWorker: [HiveWorker, any]) => hiveWorker[0].type === HiveWorkerType.HiveAccount)) {
            const accoutWorker: [HiveWorker, any] | undefined = CommonStore.getInstance().workers.find((hiveWorker: [HiveWorker, any]) => hiveWorker[0].type === HiveWorkerType.HiveAccount);

            if (accoutWorker) {
                const accountWorkerInstance: IHiveAccountWorker = accoutWorker[1] as IHiveAccountWorker;
                CommonStore.getInstance().account = await accountWorkerInstance.getHiveAccount();
            }
        }

    }

}