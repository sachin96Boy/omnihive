/// <reference path="../../../types/globals.omnihive.d.ts" />

import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { OmniHiveLogLevel } from "@withonevision/omnihive-core/enums/OmniHiveLogLevel";
import { StringHelper } from "@withonevision/omnihive-core/helpers/StringHelper";
import { ILogWorker } from "@withonevision/omnihive-core/interfaces/ILogWorker";
import { ITokenWorker } from "@withonevision/omnihive-core/interfaces/ITokenWorker";
import { ServerSettings } from "@withonevision/omnihive-core/models/ServerSettings";
import { IConfigWorker } from "@withonevision/omnihive-core/interfaces/IConfigWorker";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import * as socketio from "socket.io";
import { ServerService } from "./ServerService";
import { createAdapter } from "@socket.io/redis-adapter";
import redis from "redis";
import { AdminResponse } from "@withonevision/omnihive-core/models/AdminResponse";
import { AdminRoomType } from "@withonevision/omnihive-core/enums/AdminRoomType";
import { AdminEventType } from "@withonevision/omnihive-core/enums/AdminEventType";
import { AdminRequest } from "@withonevision/omnihive-core/models/AdminRequest";
import { ObjectHelper } from "@withonevision/omnihive-core/helpers/ObjectHelper";
import { Emitter } from "@socket.io/redis-emitter";

export class AdminService {
    private logWorker!: ILogWorker | undefined;
    private ioEmitter!: Emitter | undefined;

    public boot = async () => {
        // Initiate log worker
        this.logWorker = global.omnihive.getWorker<ILogWorker>(HiveWorkerType.Log, "ohBootLogWorker");

        this.logWorker?.write(
            OmniHiveLogLevel.Info,
            `Setting up admin server on port ${global.omnihive.bootLoaderSettings.baseSettings.adminPortNumber}...`
        );

        // Start-up admin server

        if (global.omnihive.adminServer) {
            global.omnihive.adminServer
                .of(`/${global.omnihive.bootLoaderSettings.baseSettings.serverGroupId}`)
                .disconnectSockets(true);
            global.omnihive.adminServer.close();
        }

        global.omnihive.adminServer = new socketio.Server(
            global.omnihive.bootLoaderSettings.baseSettings.adminPortNumber,
            {
                cors: {
                    origin: "*",
                    methods: "*",
                },
            }
        );

        const namespace: socketio.Namespace = global.omnihive.adminServer.of(
            global.omnihive.bootLoaderSettings.baseSettings.serverGroupId
        );

        // Enable Redis if necessary
        if (global.omnihive.bootLoaderSettings.baseSettings.clusterEnable) {
            const pubClient = redis.createClient(
                global.omnihive.bootLoaderSettings.baseSettings.clusterRedisConnectionString
            );
            const subClient = pubClient.duplicate();
            const emitClient = pubClient.duplicate();

            global.omnihive.adminServer.adapter(createAdapter(pubClient, subClient));
            this.ioEmitter = new Emitter(emitClient);
        }

        // Admin Event : Server Reset
        global.omnihive.adminServer.on(AdminEventType.ServerResetRequest, (message: AdminRequest) => {
            if (!this.checkRequest(AdminEventType.ServerResetRequest, message)) {
                return;
            }

            this.logWorker?.write(OmniHiveLogLevel.Info, "OmniHive Server Restarting...");

            setTimeout(() => {
                const serverService: ServerService = new ServerService();
                serverService.boot(true);
            }, 3000);
        });

        // Admin Event : Connection
        namespace.on(AdminEventType.Connection, (socket: socketio.Socket) => {
            socket.join(`${global.omnihive.bootLoaderSettings.baseSettings.serverGroupId}-${AdminRoomType.Command}`);

            // Socket disconnect clear memory
            socket.on(AdminEventType.Disconnect, () => {
                socket.removeAllListeners();
                global.omnihive.adminServer
                    ?.of(global.omnihive.bootLoaderSettings.baseSettings.serverGroupId)
                    .sockets.forEach((sck: socketio.Socket) => {
                        if (socket.id === sck.id) sck.disconnect(true);
                    });
            });

            // Admin Event : Access Token
            socket.on(AdminEventType.AccessTokenRequest, (message: AdminRequest) => {
                if (!this.checkRequest(AdminEventType.AccessTokenRequest, message, socket)) {
                    return;
                }

                const tokenWorker: ITokenWorker | undefined = global.omnihive.getWorker<ITokenWorker | undefined>(
                    HiveWorkerType.Token
                );

                if (!tokenWorker) {
                    this.sendSuccessToSocket(AdminEventType.AccessTokenRequest, socket, {
                        hasWorker: false,
                        token: "",
                    });

                    return;
                }

                tokenWorker.get().then((token: string) => {
                    this.sendSuccessToSocket(AdminEventType.AccessTokenRequest, socket, {
                        hasWorker: true,
                        token,
                    });
                });
            });

            // Admin Event : Config
            socket.on(AdminEventType.ConfigRequest, async (message: AdminRequest) => {
                if (!this.checkRequest(AdminEventType.ConfigRequest, message, socket)) {
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

                this.sendSuccessToSocket(AdminEventType.ConfigRequest, socket, {
                    config: serverSettings,
                });
            });

            // Admin Event : Config Save
            socket.on(AdminEventType.ConfigSaveRequest, async (message: AdminRequest<{ config: ServerSettings }>) => {
                if (!this.checkRequest(AdminEventType.ConfigSaveRequest, message, socket)) {
                    return;
                }

                try {
                    if (!message.data || !message.data.config) {
                        this.sendErrorToSocket(
                            AdminEventType.ConfigSaveRequest,
                            socket,
                            "Invalid Configuration Submitted"
                        );
                    }

                    const settings: ServerSettings = ObjectHelper.createStrict<ServerSettings>(
                        ServerSettings,
                        message.data?.config
                    );

                    const configWorker: IConfigWorker | undefined = global.omnihive.getWorker<IConfigWorker>(
                        HiveWorkerType.Config
                    );

                    if (!configWorker) {
                        throw new Error("No config worker detected on server");
                    }

                    await configWorker.set(settings);

                    this.sendSuccessToSocket(AdminEventType.ConfigSaveRequest, socket, {
                        verified: true,
                    });
                } catch (e) {
                    this.sendErrorToSocket(AdminEventType.ConfigSaveRequest, socket, e);
                    return;
                }
            });

            // Admin Event : Server Register
            socket.on(AdminEventType.RegisterRequest, (message: AdminRequest) => {
                if (!this.checkRequest(AdminEventType.RegisterRequest, message, socket)) {
                    return;
                }

                this.sendSuccessToSocket(AdminEventType.RegisterRequest, socket, { verified: true });
            });

            // Admin Event : Server Reset : Namespace
            socket.on(AdminEventType.ServerResetRequest, (message: AdminRequest) => {
                if (!this.checkRequest(AdminEventType.ServerResetRequest, message, socket)) {
                    return;
                }

                this.sendSuccessToSocket(AdminEventType.ServerResetRequest, socket, { verified: true });
                this.logWorker?.write(OmniHiveLogLevel.Info, "Broadcasting Restart...");

                setTimeout(() => {
                    if (this.ioEmitter) {
                        this.ioEmitter.serverSideEmit(AdminEventType.ServerResetRequest, message);
                    }
                }, 3000);
            });

            // Admin Event : Status
            socket.on(AdminEventType.StatusRequest, (message: AdminRequest) => {
                if (!this.checkRequest(AdminEventType.StatusRequest, message, socket)) {
                    return;
                }

                this.sendSuccessToSocket(AdminEventType.StatusRequest, socket, {
                    serverStatus: global.omnihive.serverStatus,
                    serverError: global.omnihive.serverError,
                });
            });

            // Admin Event : Start Log
            socket.on(AdminEventType.StartLogRequest, (message: AdminRequest) => {
                if (!this.checkRequest(AdminEventType.StartLogRequest, message, socket)) {
                    return;
                }

                socket.join(`${global.omnihive.bootLoaderSettings.baseSettings.serverGroupId}-${AdminRoomType.Log}`);
                this.sendSuccessToSocket(AdminEventType.StartLogRequest, socket, { verified: true });
            });

            // Admin Event : Stop Log
            socket.on(AdminEventType.StopLogRequest, (message: AdminRequest) => {
                if (!this.checkRequest(AdminEventType.StopLogRequest, message, socket)) {
                    return;
                }

                socket.leave(`${global.omnihive.bootLoaderSettings.baseSettings.serverGroupId}-${AdminRoomType.Log}`);
                this.sendSuccessToSocket(AdminEventType.StopLogRequest, socket, { verified: true });
            });

            // Admin Event : URL Request
            socket.on(AdminEventType.UrlListRequest, (message: AdminRequest) => {
                if (!this.checkRequest(AdminEventType.UrlListRequest, message, socket)) {
                    return;
                }

                this.sendSuccessToSocket(AdminEventType.UrlListRequest, socket, {
                    urls: global.omnihive.registeredUrls,
                });
            });
        });

        this.logWorker?.write(
            OmniHiveLogLevel.Info,
            `Admin server listening on port ${global.omnihive.bootLoaderSettings.baseSettings.adminPortNumber}...`
        );
    };

    private checkRequest = (adminEvent: AdminEventType, request: AdminRequest, socket?: socketio.Socket): boolean => {
        if (
            StringHelper.isNullOrWhiteSpace(request.serverGroupId) ||
            request.serverGroupId !== global.omnihive.bootLoaderSettings.baseSettings.serverGroupId
        ) {
            return false;
        }

        if (
            !StringHelper.isNullOrWhiteSpace(request.adminPassword) &&
            !StringHelper.isNullOrWhiteSpace(request.serverGroupId) &&
            request.adminPassword === global.omnihive.bootLoaderSettings.baseSettings.adminPassword &&
            request.serverGroupId === global.omnihive.bootLoaderSettings.baseSettings.serverGroupId
        ) {
            return true;
        }

        this.logWorker?.write(
            OmniHiveLogLevel.Warn,
            `Admin client register error using password ${request.adminPassword}...`
        );

        if (socket) {
            this.sendErrorToSocket(adminEvent, socket, "Invalid Admin Password");
        }

        return false;
    };

    private getResponseEventNameFromRequest = (adminEvent: AdminEventType): AdminEventType => {
        switch (adminEvent) {
            case AdminEventType.AccessTokenRequest:
                return AdminEventType.AccessTokenResponse;
            case AdminEventType.ConfigRequest:
                return AdminEventType.ConfigResponse;
            case AdminEventType.ConfigSaveRequest:
                return AdminEventType.ConfigSaveResponse;
            case AdminEventType.RegisterRequest:
                return AdminEventType.RegisterResponse;
            case AdminEventType.ServerResetRequest:
                return AdminEventType.ServerResetResponse;
            case AdminEventType.StartLogRequest:
                return AdminEventType.StartLogResponse;
            case AdminEventType.StatusRequest:
                return AdminEventType.StatusResponse;
            case AdminEventType.StopLogRequest:
                return AdminEventType.StopLogResponse;
            case AdminEventType.UrlListRequest:
                return AdminEventType.UrlListResponse;
            default:
                return AdminEventType.UnknownResponse;
        }
    };

    private sendErrorToSocket = (adminEvent: AdminEventType, socket: socketio.Socket, errorMessage: string): void => {
        const adminResponse: AdminResponse = {
            serverGroupId: global.omnihive.bootLoaderSettings.baseSettings.serverGroupId,
            requestComplete: false,
            requestError: errorMessage,
        };

        socket.emit(this.getResponseEventNameFromRequest(adminEvent), adminResponse);
    };

    private sendSuccessToSocket = (adminEvent: AdminEventType, socket: socketio.Socket, message: any): void => {
        const adminResponse: AdminResponse = {
            serverGroupId: global.omnihive.bootLoaderSettings.baseSettings.serverGroupId,
            requestComplete: true,
            requestError: undefined,
            data: message,
        };

        socket.emit(this.getResponseEventNameFromRequest(adminEvent), adminResponse);
    };
}
