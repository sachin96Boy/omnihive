import { NodeServiceFactory } from "@withonevision/omnihive-core-node/factories/NodeServiceFactory";
import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { OmniHiveLogLevel } from "@withonevision/omnihive-core/enums/OmniHiveLogLevel";
import { ServerStatus } from "@withonevision/omnihive-core/enums/ServerStatus";
import { CoreServiceFactory } from "@withonevision/omnihive-core/factories/CoreServiceFactory";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { ILogWorker } from "@withonevision/omnihive-core/interfaces/ILogWorker";
import { IServerWorker } from "@withonevision/omnihive-core/interfaces/IServerWorker";
import { RegisteredHiveWorker } from "@withonevision/omnihive-core/models/RegisteredHiveWorker";
import express from "express";
import readPkgUp from "read-pkg-up";
import { serializeError } from "serialize-error";

export class ServerService {
    public run = async (): Promise<void> => {
        const pkgJson: readPkgUp.NormalizedReadResult | undefined = await readPkgUp();
        await NodeServiceFactory.appService.initCore(pkgJson);

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
            let app: express.Express = await AwaitHelper.execute<express.Express>(
                NodeServiceFactory.appService.getCleanAppServer()
            );

            const servers: RegisteredHiveWorker[] = CoreServiceFactory.workerService.getWorkersByType(
                HiveWorkerType.Server
            );

            for (const server of servers) {
                try {
                    app = await AwaitHelper.execute<express.Express>(
                        (server.instance as IServerWorker).buildServer(app)
                    );
                } catch (e) {
                    logWorker.write(
                        OmniHiveLogLevel.Error,
                        `Skipping server worker ${server.name} due to error: ${serializeError(e)}`
                    );
                }
            }

            app.get("/", (_req, res) => {
                res.status(200).render("index", {
                    rootUrl: CoreServiceFactory.configurationService.settings.config.rootUrl,
                    registeredUrls: NodeServiceFactory.appService.getAllRegisteredUrls(),
                    status: NodeServiceFactory.appService.serverStatus,
                    error: NodeServiceFactory.appService.serverError,
                });
            });

            app.use((_req, res) => {
                return res
                    .status(404)
                    .render("404", { rootUrl: CoreServiceFactory.configurationService.settings.config.rootUrl });
            });

            app.use((err: any, _req: any, res: any, _next: any) => {
                return res.status(500).render("500", {
                    rootUrl: CoreServiceFactory.configurationService.settings.config.rootUrl,
                    error: serializeError(err),
                });
            });

            NodeServiceFactory.appService.appServer = app;
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
