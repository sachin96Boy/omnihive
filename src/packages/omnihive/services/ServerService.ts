import { NodeServiceFactory } from "@withonevision/omnihive-core-node/factories/NodeServiceFactory";
import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { OmniHiveLogLevel } from "@withonevision/omnihive-core/enums/OmniHiveLogLevel";
import { ServerStatus } from "@withonevision/omnihive-core/enums/ServerStatus";
import { CoreServiceFactory } from "@withonevision/omnihive-core/factories/CoreServiceFactory";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { ILogWorker } from "@withonevision/omnihive-core/interfaces/ILogWorker";
import { IServerWorker } from "@withonevision/omnihive-core/interfaces/IServerWorker";
import { ServerSettings } from "@withonevision/omnihive-core/models/ServerSettings";
import readPkgUp from "read-pkg-up";
import { serializeError } from "serialize-error";

export class ServerService {
    public run = async (settings: ServerSettings): Promise<void> => {
        const pkgJson: readPkgUp.NormalizedReadResult | undefined = await readPkgUp();
        await NodeServiceFactory.appService.initCore(pkgJson, settings);

        // Check server worker
        const serverWorker: IServerWorker | undefined = await CoreServiceFactory.workerService.getWorker<IServerWorker>(
            HiveWorkerType.Server
        );

        if (!serverWorker) {
            throw new Error("No server worker has been registered");
        }

        // Intialize "backbone" hive workers

        const logWorker: ILogWorker | undefined = await CoreServiceFactory.workerService.getWorker<ILogWorker>(
            HiveWorkerType.Log,
            "ohreqLogWorker"
        );

        if (!logWorker) {
            throw new Error("Core Log Worker Not Found.  Server needs the core log worker ohreqLogWorker");
        }

        // Set server to rebuilding first
        await AwaitHelper.execute<void>(NodeServiceFactory.appService.loadSpecialStatusApp(ServerStatus.Rebuilding));
        await NodeServiceFactory.appService.serverChangeHandler();

        // Try to spin up full server
        try {
            await AwaitHelper.execute<void>(serverWorker.buildServer());
            NodeServiceFactory.appService.serverStatus = ServerStatus.Online;
            await NodeServiceFactory.appService.serverChangeHandler();
        } catch (err) {
            // Problem...spin up admin server
            NodeServiceFactory.appService.loadSpecialStatusApp(ServerStatus.Admin, err);
            await NodeServiceFactory.appService.serverChangeHandler();
            logWorker.write(OmniHiveLogLevel.Error, `Server Spin-Up Error => ${JSON.stringify(serializeError(err))}`);
        }
    };
}
