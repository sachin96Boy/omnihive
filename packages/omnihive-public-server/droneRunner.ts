import { DroneType } from "@withonevision/omnihive-hive-common/enums/DroneType";
import { HiveWorkerType } from "@withonevision/omnihive-hive-common/enums/HiveWorkerType";
import { OmniHiveLogLevel } from "@withonevision/omnihive-hive-common/enums/OmniHiveLogLevel";
import { AwaitHelper } from "@withonevision/omnihive-hive-common/helpers/AwaitHelper";
import { StringHelper } from "@withonevision/omnihive-hive-common/helpers/StringHelper";
import { Drone } from "@withonevision/omnihive-hive-common/models/Drone";
import { AppService } from "@withonevision/omnihive-hive-queen/services/AppService";
import { LogService } from "@withonevision/omnihive-hive-queen/services/LogService";
import { QueenStore } from "@withonevision/omnihive-hive-queen/stores/QueenStore";
import { HiveWorkerFactory } from "@withonevision/omnihive-hive-worker/HiveWorkerFactory";
import { IFileSystemWorker } from "@withonevision/omnihive-hive-worker/interfaces/IFileSystemWorker";
import minimist from "minimist";
import readPkgUp, { NormalizedReadResult } from "read-pkg-up";
import { serializeError } from "serialize-error";
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";

// Set up args and variables
const args = minimist(process.argv.slice(2));

const argDroneName: string = args._[0];
const argFile: string = args._[1];

async function droneRunner(droneName: string, argsFile: string) {

    if (!process.env.OH_ENV_FILE) {
        throw new Error("Please provide a file path to the OmniHive Environment File (OH_ENV_FILE)");
    }

    dotenvExpand(dotenv.config({ path: process.env.OH_ENV_FILE }));

    const packageJson: NormalizedReadResult | undefined = await AwaitHelper.execute<NormalizedReadResult | undefined>(readPkgUp());
    const appService: AppService = new AppService();

    await appService.init(process.env.OH_SERVER_SETTINGS, packageJson);

    const fileSystemWorker: IFileSystemWorker | undefined = await HiveWorkerFactory.getInstance().getHiveWorker<IFileSystemWorker>(HiveWorkerType.FileSystem);

    if (!fileSystemWorker && argsFile && !StringHelper.isNullOrWhiteSpace(argFile)) {
        throw new Error("FileSystem Worker Not Found...Cannot Read Args")
    }

    // Get Drone

    const drone: Drone | undefined = QueenStore.getInstance().settings.drones.find((d: Drone) => d.name === droneName && d.enabled === true && d.type === DroneType.Task);

    if (!drone) {
        logError(droneName, new Error(`Drone ${droneName} was not found in server configuration, is disabled, or is not of the right type`));
        return;
    }

    // Set up drone args
    let droneArgs: any = null;

    if (argsFile && argsFile !== "") {
        try {
            if (fileSystemWorker) {
                droneArgs = JSON.parse(fileSystemWorker.readFile(argFile));
            }
        } catch (err) {
            logError(droneName, err);
        }
    }

    // Try running the drone
    try {
        const droneDynamicModule: any = import(drone.classPath);

        if (!(droneArgs === null || droneArgs === undefined)) {
            await droneDynamicModule.default(droneArgs);
        } else {
            await droneDynamicModule.default();
        }

    } catch (err) {
        logError(droneName, err);
    }
}

async function logError(droneName: string, err: Error) {

    const logService: LogService = LogService.getInstance();

    console.log(err);
    logService.write(OmniHiveLogLevel.Error, `Drone Runner => ${droneName} => Error => ${JSON.stringify(serializeError(err))}`);
    throw new Error(`Drone Runner => ${droneName} => Error => ${JSON.stringify(serializeError(err))}`);
}

// Run drone
droneRunner(argDroneName, argFile);