/// <reference path="../../../types/globals.omnihive.d.ts" />

import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { OmniHiveLogLevel } from "@withonevision/omnihive-core/enums/OmniHiveLogLevel";
import { ServerStatus } from "@withonevision/omnihive-core/enums/ServerStatus";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { IServerWorker } from "@withonevision/omnihive-core/interfaces/IServerWorker";
import { RegisteredHiveWorker } from "@withonevision/omnihive-core/models/RegisteredHiveWorker";
import express from "express";
import readPkgUp from "read-pkg-up";
import { serializeError } from "serialize-error";
import { AppService } from "./AppService";
import { LogService } from "./LogService";

export class ServerService {
    public run = async (): Promise<void> => {
        const appService: AppService = new AppService();

        try {
            const pkgJson: readPkgUp.NormalizedReadResult | undefined = await readPkgUp();
            const logService: LogService = new LogService();

            await appService.initCore(pkgJson);

            // Set server to rebuilding first
            await AwaitHelper.execute<void>(appService.loadSpecialStatusApp(ServerStatus.Rebuilding));
            await appService.serverChangeHandler();

            // Try to spin up full server
            let app: express.Express = await AwaitHelper.execute<express.Express>(appService.getCleanAppServer());

            const servers: RegisteredHiveWorker[] = global.omnihive.registeredWorkers.filter(
                (rw: RegisteredHiveWorker) => rw.type === HiveWorkerType.Server && rw.enabled === true
            );

            for (const server of servers) {
                try {
                    app = await AwaitHelper.execute<express.Express>(
                        (server.instance as IServerWorker).buildServer(app)
                    );
                } catch (e) {
                    logService.write(
                        OmniHiveLogLevel.Error,
                        `Skipping server worker ${server.name} due to error: ${serializeError(e)}`
                    );
                }
            }

            app.get("/", (_req, res) => {
                res.status(200).render("index", {
                    rootUrl: global.omnihive.getWebRootUrlWithPort(),
                    registeredUrls: global.omnihive.registeredUrls,
                    status: global.omnihive.serverStatus,
                    error: global.omnihive.serverError,
                });
            });

            app.use((_req, res) => {
                return res.status(404).render("404", { rootUrl: global.omnihive.getWebRootUrlWithPort() });
            });

            app.use((err: any, _req: any, res: any, _next: any) => {
                return res.status(500).render("500", {
                    rootUrl: global.omnihive.getWebRootUrlWithPort(),
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
            const logService: LogService = new LogService();
            logService.write(OmniHiveLogLevel.Error, `Server Spin-Up Error => ${JSON.stringify(serializeError(err))}`);
        }
    };
}
