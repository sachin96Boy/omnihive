/// <reference path="../../../types/globals.omnihive.d.ts" />

import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { OmniHiveLogLevel } from "@withonevision/omnihive-core/enums/OmniHiveLogLevel";
import { ServerStatus } from "@withonevision/omnihive-core/enums/ServerStatus";
import { ObjectHelper } from "@withonevision/omnihive-core/helpers/ObjectHelper";
import { StringHelper } from "@withonevision/omnihive-core/helpers/StringHelper";
import { ILogWorker } from "@withonevision/omnihive-core/interfaces/ILogWorker";
import { AdminEvent } from "@withonevision/omnihive-core/models/AdminEvent";
import { AdminEventResponse } from "@withonevision/omnihive-core/models/AdminEventResponse";
import { RegisteredUrl } from "@withonevision/omnihive-core/models/RegisteredUrl";
import { ServerSettings } from "@withonevision/omnihive-core/models/ServerSettings";
import Conf from "conf";
import fse from "fs-extra";
import WebSocket from "ws";
import { ServerService } from "./ServerService";

interface ExtendedWebSocket extends WebSocket {
    isAlive: boolean;
}

export class AdminService {
    public run = async () => {
        const logWorker: ILogWorker | undefined = global.omnihive.getWorker<ILogWorker>(
            HiveWorkerType.Log,
            "ohreqLogWorker"
        );

        logWorker?.write(
            OmniHiveLogLevel.Info,
            `Setting up admin server on port ${global.omnihive.serverSettings.config.adminPortNumber}...`
        );

        global.omnihive.adminServer = new WebSocket.Server({
            port: global.omnihive.serverSettings.config.adminPortNumber,
        });

        global.omnihive.adminServer.on("close", () => {
            clearInterval(global.omnihive.adminServerTimer);
        });

        global.omnihive.adminServer.on("connection", (ws: WebSocket) => {
            (ws as ExtendedWebSocket).isAlive = true;

            ws.on("pong", (ws: WebSocket) => {
                this.heartbeat(ws);
            });

            ws.on("message", (message: string) => {
                if (!this.checkWsMessage("config-request", message)) {
                    return;
                }

                const request: AdminEvent = JSON.parse(message);

                if (
                    !request ||
                    !request.adminPassword ||
                    StringHelper.isNullOrWhiteSpace(request.adminPassword) ||
                    request.adminPassword !== global.omnihive.serverSettings.config.adminPassword
                ) {
                    this.sendErrorToSingleClient(ws, "config-request-response", new Error("Invalid Password"));
                    return;
                }

                const config = new Conf({ projectName: "omnihive", configName: "omnihive" });
                const latestConf: string | undefined = config.get<string>(
                    `latest-settings-${global.omnihive.instanceName}`
                ) as string;
                let serverSettings: ServerSettings = new ServerSettings();

                try {
                    serverSettings = ObjectHelper.createStrict<ServerSettings>(
                        ServerSettings,
                        JSON.parse(fse.readFileSync(latestConf, { encoding: "utf8" }))
                    );
                } catch {
                    serverSettings = global.omnihive.serverSettings;
                }

                this.sendToSingleClient<{ config: ServerSettings }>(ws, "config-response", { config: serverSettings });
            });

            ws.on("message", (message: string) => {
                if (!this.checkWsMessage("config-save-request", message)) {
                    return;
                }

                const request: AdminEvent<{ config: ServerSettings }> = JSON.parse(message);

                if (
                    !request ||
                    !request.adminPassword ||
                    StringHelper.isNullOrWhiteSpace(request.adminPassword) ||
                    request.adminPassword !== global.omnihive.serverSettings.config.adminPassword ||
                    !request.data?.config
                ) {
                    this.sendErrorToSingleClient(ws, "config-save-response", new Error("Invalid Password"));
                    return;
                }

                try {
                    const settings: ServerSettings = request.data?.config as ServerSettings;
                    const config = new Conf({ projectName: "omnihive", configName: "omnihive" });
                    const latestConf: string | undefined = config.get<string>(
                        `latest-settings-${global.omnihive.instanceName}`
                    ) as string;

                    fse.writeFileSync(latestConf, JSON.stringify(settings));
                    this.sendToSingleClient<{ verified: boolean }>(ws, "config-save-response", { verified: true });
                } catch (e) {
                    this.sendErrorToSingleClient(ws, "config-save-response", e);
                    return;
                }
            });

            ws.on("message", (message: string) => {
                if (!this.checkWsMessage("refresh-request", message)) {
                    return;
                }

                const request: AdminEvent<{ refresh?: boolean }> = JSON.parse(message);

                if (
                    !request ||
                    !request.adminPassword ||
                    StringHelper.isNullOrWhiteSpace(request.adminPassword) ||
                    request.adminPassword !== global.omnihive.serverSettings.config.adminPassword ||
                    !request.data?.refresh
                ) {
                    this.sendErrorToSingleClient(ws, "refresh-response", new Error("Invalid Password"));
                    return;
                }

                const serverService: ServerService = new ServerService();
                serverService.run(true);

                this.sendToSingleClient<{ refresh: boolean }>(ws, "refresh-response", { refresh: true });
            });

            ws.on("message", (message: string) => {
                if (!this.checkWsMessage("register-request", message)) {
                    return;
                }

                const request: AdminEvent = JSON.parse(message);

                if (
                    !request ||
                    !request.adminPassword ||
                    StringHelper.isNullOrWhiteSpace(request.adminPassword) ||
                    request.adminPassword !== global.omnihive.serverSettings.config.adminPassword
                ) {
                    logWorker?.write(
                        OmniHiveLogLevel.Warn,
                        `Admin client register error using password ${request.adminPassword}...`
                    );

                    this.sendErrorToSingleClient(ws, "register-response", new Error("Invalid Password"));
                    return;
                }

                this.sendToSingleClient<{ verified: boolean }>(ws, "register-response", { verified: true });
            });

            ws.on("message", (message: string) => {
                if (!this.checkWsMessage("status-request", message)) {
                    return;
                }

                const request: AdminEvent = JSON.parse(message);

                if (
                    !request ||
                    !request.adminPassword ||
                    StringHelper.isNullOrWhiteSpace(request.adminPassword) ||
                    request.adminPassword !== global.omnihive.serverSettings.config.adminPassword
                ) {
                    this.sendErrorToSingleClient(ws, "status-response", new Error("Invalid Password"));
                    return;
                }

                this.sendToSingleClient<{ serverStatus: ServerStatus; serverError: any | undefined }>(
                    ws,
                    "status-response",
                    {
                        serverStatus: global.omnihive.serverStatus,
                        serverError: global.omnihive.serverError,
                    }
                );
            });

            ws.on("message", (message: string) => {
                if (!this.checkWsMessage("urls-request", message)) {
                    return;
                }

                const request: AdminEvent = JSON.parse(message);

                if (
                    !request ||
                    !request.adminPassword ||
                    StringHelper.isNullOrWhiteSpace(request.adminPassword) ||
                    request.adminPassword !== global.omnihive.serverSettings.config.adminPassword
                ) {
                    this.sendErrorToSingleClient(ws, "urls-response", new Error("Invalid Password"));
                    return;
                }

                this.sendToSingleClient<{ urls: RegisteredUrl[] }>(ws, "urls-response", {
                    urls: global.omnihive.registeredUrls,
                });
            });
        });

        global.omnihive.adminServerTimer = setInterval(() => {
            global.omnihive.adminServer.clients.forEach((ws: WebSocket) => {
                if ((ws as ExtendedWebSocket).isAlive === false) {
                    return ws.terminate();
                }

                (ws as ExtendedWebSocket).isAlive = false;
                ws.ping(this.noop);
            });
        }, 20000);

        logWorker?.write(
            OmniHiveLogLevel.Info,
            `Admin server listening on port ${global.omnihive.serverSettings.config.adminPortNumber}...`
        );
    };

    public sendToAllClients = <T>(event: string, data?: T) => {
        let adminEventResponse: AdminEventResponse<T> = {
            event,
            data,
            requestComplete: true,
            requestError: undefined,
        };

        global.omnihive.adminServer.clients.forEach((ws: WebSocket) => {
            ws.send(JSON.stringify(adminEventResponse));
        });
    };

    private checkWsMessage = (eventName: string, message: string): boolean => {
        if (StringHelper.isNullOrWhiteSpace(message)) {
            return false;
        }

        try {
            const response: AdminEventResponse = ObjectHelper.create(AdminEventResponse, JSON.parse(message));

            if (response.event === eventName) {
                return true;
            }

            return false;
        } catch {
            return false;
        }
    };

    private heartbeat = (ws: WebSocket) => {
        (ws as ExtendedWebSocket).isAlive = true;
    };

    private noop = (): void => {};

    private sendErrorToSingleClient = (ws: WebSocket, event: string, error: Error) => {
        ws.send(
            JSON.stringify({
                event,
                requestComplete: false,
                requestError: error,
            })
        );
    };

    private sendToSingleClient = <T>(ws: WebSocket, event: string, data?: T) => {
        let adminEventResponse: AdminEventResponse<T> = {
            event,
            data,
            requestComplete: true,
            requestError: undefined,
        };

        ws.send(JSON.stringify(adminEventResponse));
    };
}
