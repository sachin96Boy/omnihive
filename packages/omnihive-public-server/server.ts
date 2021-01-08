#!/usr/bin/env node
import { HiveWorkerType } from "@withonevision/omnihive-hive-common/enums/HiveWorkerType";
import { OmniHiveLogLevel } from "@withonevision/omnihive-hive-common/enums/OmniHiveLogLevel";
import { ServerStatus } from "@withonevision/omnihive-hive-common/enums/ServerStatus";
import { AwaitHelper } from "@withonevision/omnihive-hive-common/helpers/AwaitHelper";
import { OmniHiveConstants } from "@withonevision/omnihive-hive-common/models/OmniHiveConstants";
import { AppService } from "@withonevision/omnihive-hive-queen/services/AppService";
import { LogService } from "@withonevision/omnihive-hive-queen/services/LogService";
import { QueenStore } from "@withonevision/omnihive-hive-queen/stores/QueenStore";
import { HiveWorkerFactory } from "@withonevision/omnihive-hive-worker/HiveWorkerFactory";
import { IPubSubClientWorker } from "@withonevision/omnihive-hive-worker/interfaces/IPubSubClientWorker";
import { IPubSubServerWorker } from "@withonevision/omnihive-hive-worker/interfaces/IPubSubServerWorker";
import { IServerWorker } from "@withonevision/omnihive-hive-worker/interfaces/IServerWorker";
import os from "os";
import readPkgUp, { NormalizedReadResult } from "read-pkg-up";
import { serializeError } from "serialize-error";
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import http, { Server } from "http";
import { ServerStore } from "./stores/ServerStore";

const start = async (): Promise<void> => {

    if (!process.env.OH_ENV_FILE) {
        throw new Error("Please provide a file path to the OmniHive Environment File (OH_ENV_FILE)");
    }

    dotenvExpand(dotenv.config({ path: process.env.OH_ENV_FILE }));

    const packageJson: NormalizedReadResult | undefined = await AwaitHelper.execute<NormalizedReadResult | undefined>(readPkgUp());
    const appService: AppService = new AppService();

    await appService.init(process.env.OH_SERVER_SETTINGS, packageJson);

    // Intialize "backbone" hive workers

    const serverWorker: IServerWorker | undefined = await AwaitHelper.execute<IServerWorker | undefined>(
        HiveWorkerFactory.getInstance().getHiveWorker<IServerWorker>(HiveWorkerType.Server));

    if (!serverWorker) {
        throw new Error("No server worker found");
    }

    const adminPubSubServer: IPubSubServerWorker | undefined = await AwaitHelper.execute<IPubSubServerWorker | undefined>(
        HiveWorkerFactory.getInstance().getHiveWorker<IPubSubServerWorker>(HiveWorkerType.PubSubServer, OmniHiveConstants.ADMIN_PUBSUB_SERVER_WORKER_INSTANCE));


    const adminPubSubClient: IPubSubClientWorker | undefined = await AwaitHelper.execute<IPubSubClientWorker | undefined>(
        HiveWorkerFactory.getInstance().getHiveWorker<IPubSubClientWorker>(HiveWorkerType.PubSubClient, OmniHiveConstants.ADMIN_PUBSUB_CLIENT_WORKER_INSTANCE));


    adminPubSubClient?.joinChannel(QueenStore.getInstance().settings.server.serverGroupName);
    LogService.getInstance().write(OmniHiveLogLevel.Info, "Admin Pusher Channel => Connected");

    adminPubSubClient?.addListener(QueenStore.getInstance().settings.server.serverGroupName, "server-reset-request", (data: { reset: boolean; }) => {

        if (!data || !data.reset) {
            return;
        }

        ServerStore.getInstance().loadSpecialStatusApp(ServerStatus.Rebuilding)
            .then(() => {
                serverChangeHandler();

                try {
                    serverWorker.buildServer()
                        .then(() => {
                            serverChangeHandler();

                            LogService.getInstance().write(OmniHiveLogLevel.Info, `Server Spin-Up Complete => Online `);
                            adminPubSubServer?.emit(
                                QueenStore.getInstance().settings.server.serverGroupName,
                                "server-reset-result",
                                {
                                    serverName: os.hostname(),
                                    success: true,
                                    error: ""
                                });
                        })
                        .catch((err: Error) => {
                            ServerStore.getInstance().loadSpecialStatusApp(ServerStatus.Admin, err);

                            serverChangeHandler();

                            LogService.getInstance().write(OmniHiveLogLevel.Error, `Server Spin-Up Error => ${JSON.stringify(serializeError(err))}`);
                            adminPubSubServer?.emit(
                                QueenStore.getInstance().settings.server.serverGroupName,
                                "server-reset-result",
                                {
                                    serverName: os.hostname(),
                                    success: false,
                                    error: JSON.stringify(serializeError(err))
                                });
                        });
                } catch (err) {

                    ServerStore.getInstance().loadSpecialStatusApp(ServerStatus.Admin, err);

                    serverChangeHandler();

                    LogService.getInstance().write(OmniHiveLogLevel.Error, `Server Spin-Up Error => ${JSON.stringify(serializeError(err))}`);
                    adminPubSubServer?.emit(
                        QueenStore.getInstance().settings.server.serverGroupName,
                        "server-reset-result",
                        {
                            serverName: os.hostname(),
                            success: false,
                            error: JSON.stringify(serializeError(err))
                        });
                }
            });
    });

    // Set server to rebuilding first
    await AwaitHelper.execute<void>(ServerStore.getInstance().loadSpecialStatusApp(ServerStatus.Rebuilding));
    serverChangeHandler();

    // Try to spin up full server
    try {
        await AwaitHelper.execute<void>(serverWorker.buildServer());
        QueenStore.getInstance().changeSystemStatus(ServerStatus.Online);
        serverChangeHandler();
    } catch (err) {
        // Problem...spin up admin server
        ServerStore.getInstance().loadSpecialStatusApp(ServerStatus.Admin, err);
        serverChangeHandler();
        LogService.getInstance().write(OmniHiveLogLevel.Error, `Server Spin-Up Error => ${JSON.stringify(serializeError(err))}`);
    }
}

const serverChangeHandler = (): void => {

    LogService.getInstance().write(OmniHiveLogLevel.Info, `Server Change Handler Started`);

    const server: Server = http.createServer(ServerStore.getInstance().appServer);

    if (ServerStore.getInstance().webServer) {
        ServerStore.getInstance().webServer?.removeAllListeners().close();
    }

    ServerStore.getInstance().webServer = server;

    ServerStore.getInstance().webServer?.listen(QueenStore.getInstance().settings.server.portNumber, () => {
        LogService.getInstance().write(OmniHiveLogLevel.Info, `New Server Listening on process ${process.pid} using port ${QueenStore.getInstance().settings.server.portNumber}`);
    });

    LogService.getInstance().write(OmniHiveLogLevel.Info, `Server Change Handler Completed`);

}

start();