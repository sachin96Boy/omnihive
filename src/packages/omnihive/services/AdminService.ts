/// <reference path="../../../types/globals.omnihive.d.ts" />

import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { OmniHiveLogLevel } from "@withonevision/omnihive-core/enums/OmniHiveLogLevel";
import { ServerStatus } from "@withonevision/omnihive-core/enums/ServerStatus";
import { ObjectHelper } from "@withonevision/omnihive-core/helpers/ObjectHelper";
import { StringHelper } from "@withonevision/omnihive-core/helpers/StringHelper";
import { ILogWorker } from "@withonevision/omnihive-core/interfaces/ILogWorker";
import { ITokenWorker } from "@withonevision/omnihive-core/interfaces/ITokenWorker";
import { AdminRequest } from "@withonevision/omnihive-core/models/AdminRequest";
import { AdminResponse } from "@withonevision/omnihive-core/models/AdminResponse";
import { RegisteredUrl } from "@withonevision/omnihive-core/models/RegisteredUrl";
import { ServerSettings } from "@withonevision/omnihive-core/models/ServerSettings";
import { IConfigWorker } from "@withonevision/omnihive-core/interfaces/IConfigWorker";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { HiveWorkerBase } from "@withonevision/omnihive-core/models/HiveWorkerBase";
import { HiveWorker } from "@withonevision/omnihive-core/models/HiveWorker";
import { serializeError } from "serialize-error";
import * as socketio from "socket.io";
import { BootService } from "./BootService";

export class AdminService {
    public boot = async () => {
        const logWorker: ILogWorker | undefined = global.omnihive.getWorker<ILogWorker>(
            HiveWorkerType.Log,
            "ohBootLogWorker"
        );

        logWorker?.write(
            OmniHiveLogLevel.Info,
            `Setting up admin server on port ${global.omnihive.bootLoaderSettings.baseSettings.adminPortNumber}...`
        );

        global.omnihive.adminServer = new socketio.Server();

        if (global.omnihive.bootLoaderSettings.baseSettings.adminRedisEnable) {
            this.ioServer.adapter({});
        }

        this.adminServer.on("close", () => {
            clearInterval(this.adminServerTimer);
        });

        global.omnihive.eventEmitter.on("serverReset", () => {
            if (global.omnihive.bootLoaderSettings.baseSettings.hardResetOnRefresh === true) {
                process.on("exit", () => {
                    childProcess.spawn(process.argv.shift() ?? "", process.argv, {
                        cwd: process.cwd(),
                        detached: true,
                        stdio: "inherit",
                    });
                });

                process.exit();
            }

            const bootService: BootService = new BootService();
            bootService.boot(true);
        });

        this.adminServer.on("connection", (ws: WebSocket) => {
            (ws as ExtendedWebSocket).isAlive = true;

            ws.on("message", (message: string) => {
                if (!this.checkWsMessage("heartbeat-request", message)) {
                    return;
                }

                (ws as ExtendedWebSocket).isAlive = true;

                this.sendToSingleClient<{ alive: boolean }>(ws, "heartbeat-reponse", { alive: true });
            });

            ws.on("message", (message: string) => {
                if (!this.checkWsMessage("heartbeat-response", message)) {
                    return;
                }

                (ws as ExtendedWebSocket).isAlive = true;
            });

            ws.on("message", async (message: string) => {
                if (!this.checkWsMessage("config-request", message)) {
                    return;
                }

                const request: AdminRequest = JSON.parse(message);

                if (
                    !request ||
                    !request.adminPassword ||
                    StringHelper.isNullOrWhiteSpace(request.adminPassword) ||
                    request.adminPassword !== global.omnihive.bootLoaderSettings.baseSettings.adminPassword
                ) {
                    this.sendErrorToSingleClient(ws, "config-request-response", "Invalid Password");
                    return;
                }

                let serverSettings: ServerSettings = new ServerSettings();

                const configWorker: IConfigWorker | undefined = global.omnihive.getWorker<IConfigWorker>(
                    HiveWorkerType.Config
                );

                if (!configWorker) {
                    serverSettings = global.omnihive.serverSettings;
                } else {
                    try {
                        serverSettings = await AwaitHelper.execute(configWorker.get());
                    } catch {
                        serverSettings = global.omnihive.serverSettings;
                    }
                }

                this.sendToSingleClient<{ config: ServerSettings }>(ws, "config-response", { config: serverSettings });
            });

            ws.on("message", (message: string) => {
                if (!this.checkWsMessage("access-token-request", message)) {
                    return;
                }

                const request: AdminRequest<{ serverLabel: string }> = JSON.parse(message);

                if (!request.data) {
                    this.sendErrorToSingleClient(ws, "access-token-response", "No Server Label Given");
                    return;
                }

                const tokenWorker: ITokenWorker | undefined = global.omnihive.getWorker<ITokenWorker | undefined>(
                    HiveWorkerType.Token
                );

                if (!tokenWorker) {
                    this.sendToSingleClient<{ hasWorker: boolean; token: string }>(ws, "access-token-response", {
                        hasWorker: false,
                        token: "",
                    });

                    return;
                }

                tokenWorker.get().then((token: string) => {
                    if (!request.data) {
                        this.sendErrorToSingleClient(ws, "access-token-response", "No Server Label Given");
                        return;
                    }

                    this.sendToSingleClient<{ serverLabel: string; hasWorker: boolean; token: string }>(
                        ws,
                        "access-token-response",
                        {
                            hasWorker: true,
                            token,
                            serverLabel: request.data.serverLabel,
                        }
                    );
                });
            });

            ws.on("message", async (message: string) => {
                if (!this.checkWsMessage("config-save-request", message)) {
                    return;
                }

                const request: AdminRequest<{ config: ServerSettings }> = JSON.parse(message);

                if (
                    !request ||
                    !request.adminPassword ||
                    StringHelper.isNullOrWhiteSpace(request.adminPassword) ||
                    request.adminPassword !== global.omnihive.bootLoaderSettings.baseSettings.adminPassword ||
                    !request.data?.config
                ) {
                    this.sendErrorToSingleClient(ws, "config-save-response", "Invalid Password");
                    return;
                }

                try {
                    const settings: ServerSettings = request.data?.config as ServerSettings;

                    const configWorker: IConfigWorker | undefined = global.omnihive.getWorker<IConfigWorker>(
                        HiveWorkerType.Config
                    );

                    if (!configWorker) {
                        throw new Error("No config worker detected.  OmniHive config cannot be saved");
                    }

                    await configWorker.set(settings);

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

                const request: AdminRequest<{ refresh?: boolean }> = JSON.parse(message);

                if (
                    !request ||
                    !request.adminPassword ||
                    StringHelper.isNullOrWhiteSpace(request.adminPassword) ||
                    request.adminPassword !== global.omnihive.bootLoaderSettings.baseSettings.adminPassword ||
                    !request.data?.refresh
                ) {
                    this.sendErrorToSingleClient(ws, "refresh-response", "Invalid Password");
                    return;
                }

                this.sendToSingleClient<{ refresh: boolean }>(ws, "refresh-response", { refresh: true });
                global.omnihive.eventEmitter.emit("serverReset");
            });

            ws.on("message", (message: string) => {
                if (!this.checkWsMessage("register-request", message)) {
                    return;
                }

                const request: AdminRequest = JSON.parse(message);

                if (
                    !request ||
                    !request.adminPassword ||
                    StringHelper.isNullOrWhiteSpace(request.adminPassword) ||
                    request.adminPassword !== global.omnihive.bootLoaderSettings.baseSettings.adminPassword
                ) {
                    logWorker?.write(
                        OmniHiveLogLevel.Warn,
                        `Admin client register error using password ${request.adminPassword}...`
                    );

                    this.sendErrorToSingleClient(ws, "register-response", "Invalid Password");
                    return;
                }

                this.sendToSingleClient<{ verified: boolean }>(ws, "register-response", { verified: true });
            });

            ws.on("message", (message: string) => {
                if (!this.checkWsMessage("status-request", message)) {
                    return;
                }

                const request: AdminRequest = JSON.parse(message);

                if (
                    !request ||
                    !request.adminPassword ||
                    StringHelper.isNullOrWhiteSpace(request.adminPassword) ||
                    request.adminPassword !== global.omnihive.bootLoaderSettings.baseSettings.adminPassword
                ) {
                    this.sendErrorToSingleClient(ws, "status-response", "Invalid Password");
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

                const request: AdminRequest = JSON.parse(message);

                if (
                    !request ||
                    !request.adminPassword ||
                    StringHelper.isNullOrWhiteSpace(request.adminPassword) ||
                    request.adminPassword !== global.omnihive.bootLoaderSettings.baseSettings.adminPassword
                ) {
                    this.sendErrorToSingleClient(ws, "urls-response", "Invalid Password");
                    return;
                }

                this.sendToSingleClient<{ urls: RegisteredUrl[] }>(ws, "urls-response", {
                    urls: global.omnihive.registeredUrls,
                });
            });
        });

        this.adminServerTimer = setInterval(() => {
            if (!this.adminServer || !this.adminServer.clients) {
                return;
            }

            this.adminServer.clients.forEach((ws: WebSocket) => {
                if ((ws as ExtendedWebSocket).isAlive === false) {
                    return ws.terminate();
                }

                (ws as ExtendedWebSocket).isAlive = false;
                this.sendToSingleClient(ws, "heartbeat-request");
            });
        }, 20000);

        logWorker?.write(OmniHiveLogLevel.Info, `Admin server listening on port ${this.portNumber}...`);
    };

    public sendToAllClients = async <T>(event: string, data?: T): Promise<void> => {
        if (!this.adminServer || !this.adminServer.clients) {
            return;
        }

        let adminEventResponse: AdminResponse<T> = {
            event,
            data,
            requestComplete: true,
            requestError: undefined,
        };

        this.adminServer.clients.forEach((ws: WebSocket) => {
            ws.send(JSON.stringify(adminEventResponse));
        });
    };

    private checkWsMessage = (eventName: string, message: string): boolean => {
        if (StringHelper.isNullOrWhiteSpace(message)) {
            return false;
        }

        try {
            const response: AdminResponse = ObjectHelper.create(AdminResponse, JSON.parse(message));

            if (response.event === eventName) {
                return true;
            }

            return false;
        } catch {
            return false;
        }
    };

    private sendErrorToSingleClient = (ws: WebSocket, event: string, error: string) => {
        ws.send(
            JSON.stringify({
                event,
                requestComplete: false,
                requestError: error,
            })
        );
    };

    private sendToSingleClient = <T>(ws: WebSocket, event: string, data?: T) => {
        let adminResponse: AdminResponse<T> = {
            event,
            data,
            requestComplete: true,
            requestError: undefined,
        };

        ws.send(JSON.stringify(adminResponse));
    };
}
