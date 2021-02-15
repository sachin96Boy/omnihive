/// <reference path="../../../types/globals.omnihive.d.ts" />

import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { OmniHiveLogLevel } from "@withonevision/omnihive-core/enums/OmniHiveLogLevel";
import { ServerStatus } from "@withonevision/omnihive-core/enums/ServerStatus";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { ILogWorker } from "@withonevision/omnihive-core/interfaces/ILogWorker";
import { IServerWorker } from "@withonevision/omnihive-core/interfaces/IServerWorker";
import { RegisteredHiveWorker } from "@withonevision/omnihive-core/models/RegisteredHiveWorker";
import express from "express";
import readPkgUp from "read-pkg-up";
import { serializeError } from "serialize-error";
import { AppService } from "./AppService";
import { WorkerService } from "./WorkerService";

export class ServerService {
    public run = async (): Promise<void> => {
        const pkgJson: readPkgUp.NormalizedReadResult | undefined = await readPkgUp();
        const appService: AppService = new AppService();
        const workerService: WorkerService = new WorkerService();

        await appService.initCore(pkgJson);

        // Intialize "backbone" hive workers

        const logWorker: ILogWorker | undefined = workerService.getWorker<ILogWorker>(
            HiveWorkerType.Log,
            "ohreqLogWorker"
        );

        if (!logWorker) {
            throw new Error("Core Log Worker Not Found.  Server needs the core log worker ohreqLogWorker");
        }

        // Set server to rebuilding first
        await AwaitHelper.execute<void>(appService.loadSpecialStatusApp(ServerStatus.Rebuilding));
        await appService.serverChangeHandler();

        // Try to spin up full server
        try {
            let app: express.Express = await AwaitHelper.execute<express.Express>(appService.getCleanAppServer());

            const servers: RegisteredHiveWorker[] = workerService.getWorkersByType(HiveWorkerType.Server);

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
                    rootUrl: global.omnihive.serverSettings.config.rootUrl,
                    registeredUrls: global.omnihive.registeredUrls,
                    status: global.omnihive.serverStatus,
                    error: global.omnihive.serverError,
                });
            });

            app.use((_req, res) => {
                return res.status(404).render("404", { rootUrl: global.omnihive.serverSettings.config.rootUrl });
            });

            app.use((err: any, _req: any, res: any, _next: any) => {
                return res.status(500).render("500", {
                    rootUrl: global.omnihive.serverSettings.config.rootUrl,
                    error: serializeError(err),
                });
            });

            global.omnihive.appServer = app;
            global.omnihive.serverStatus = ServerStatus.Online;
            await appService.serverChangeHandler();
        } catch (err) {
            // Problem...spin up admin server
            appService.loadSpecialStatusApp(ServerStatus.Admin, err);
            await appService.serverChangeHandler();
            logWorker.write(OmniHiveLogLevel.Error, `Server Spin-Up Error => ${JSON.stringify(serializeError(err))}`);
        }
    };
}
