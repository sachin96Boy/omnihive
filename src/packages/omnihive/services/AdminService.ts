/// <reference path="../../../types/globals.omnihive.d.ts" />

import { createAdapter } from "@socket.io/redis-adapter";
import { Emitter } from "@socket.io/redis-emitter";
import { AdminEventType } from "@withonevision/omnihive-core/enums/AdminEventType";
import { AdminRoomType } from "@withonevision/omnihive-core/enums/AdminRoomType";
import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { OmniHiveLogLevel } from "@withonevision/omnihive-core/enums/OmniHiveLogLevel";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { IsHelper } from "@withonevision/omnihive-core/helpers/IsHelper";
import { ObjectHelper } from "@withonevision/omnihive-core/helpers/ObjectHelper";
import { IConfigWorker } from "@withonevision/omnihive-core/interfaces/IConfigWorker";
import { ILogWorker } from "@withonevision/omnihive-core/interfaces/ILogWorker";
import { ITokenWorker } from "@withonevision/omnihive-core/interfaces/ITokenWorker";
import { AdminRequest } from "@withonevision/omnihive-core/models/AdminRequest";
import { AdminResponse } from "@withonevision/omnihive-core/models/AdminResponse";
import { AppSettings } from "@withonevision/omnihive-core/models/AppSettings";
import { EnvironmentVariable } from "@withonevision/omnihive-core/models/EnvironmentVariable";
import ipc from "node-ipc";
import redis from "redis";
import * as socketio from "socket.io";
import { v4 as uuidv4 } from "uuid";

let ipcId: string = uuidv4();
ipc.config.id = ipcId;
ipc.config.retry = 1000;
ipc.config.sync = true;

export class AdminService {
    private logWorker!: ILogWorker | undefined;
    private ioEmitter!: Emitter | undefined;

    public run = async () => {
        const adminPortNumber = global.omnihive.getEnvironmentVariable<number>("OH_ADMIN_PORT_NUMBER");
        const serverGroupId = global.omnihive.getEnvironmentVariable<string>("OH_ADMIN_SERVER_GROUP_ID");
        const clusterEnabled = global.omnihive.getEnvironmentVariable<boolean>("OH_CLUSTER_ENABLE");
        const clusterConnectionString = global.omnihive.getEnvironmentVariable<string>(
            "OH_CLUSTER_REDIS_CONNECTION_STRING"
        );

        if (IsHelper.isNullOrUndefined(serverGroupId) || IsHelper.isNullOrUndefined(adminPortNumber)) {
            throw new Error("Server group ID or admin port is undefined");
        }

        // Initiate log worker
        this.logWorker = global.omnihive.getWorker<ILogWorker>(HiveWorkerType.Log, "__ohBootLogWorker");

        this.logWorker?.write(OmniHiveLogLevel.Info, `Setting up admin server on port ${adminPortNumber}...`);

        // Start-up admin server

        if (!IsHelper.isNullOrUndefined(global.omnihive.adminServer)) {
            global.omnihive.adminServer.of(`/${serverGroupId}`).disconnectSockets(true);
            global.omnihive.adminServer.close();
        }

        global.omnihive.adminServer = new socketio.Server(adminPortNumber, {
            cors: {
                origin: "*",
                methods: "*",
            },
        });

        const namespace: socketio.Namespace = global.omnihive.adminServer.of(serverGroupId);

        // Enable Redis if necessary
        if (clusterEnabled && !IsHelper.isNullOrUndefined(clusterConnectionString)) {
            const pubClient = redis.createClient(clusterConnectionString);
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
                ipc.connectTo(global.omnihive.commandLineArgs.ipcServerId, () => {
                    ipc.of[global.omnihive.commandLineArgs.ipcServerId].on("connect", () => {
                        ipc.of[global.omnihive.commandLineArgs.ipcServerId].emit("omnihive.reboot");
                    });
                });
            }, 2000);
        });

        // Admin Event : Connection
        namespace.on(AdminEventType.Connection, (socket: socketio.Socket) => {
            socket.join(`${serverGroupId}-${AdminRoomType.Command}`);

            // Socket disconnect clear memory
            socket.on(AdminEventType.Disconnect, () => {
                socket.removeAllListeners();
                global.omnihive.adminServer?.of(serverGroupId).sockets.forEach((sck: socketio.Socket) => {
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

                if (IsHelper.isNullOrUndefined(tokenWorker)) {
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

                let appSettings: AppSettings = new AppSettings();

                const configWorker: IConfigWorker | undefined = global.omnihive.getWorker<IConfigWorker>(
                    HiveWorkerType.Config
                );

                if (IsHelper.isNullOrUndefined(configWorker)) {
                    appSettings = global.omnihive.appSettings;
                } else {
                    try {
                        appSettings = await AwaitHelper.execute(configWorker.get());
                    } catch {
                        appSettings = global.omnihive.appSettings;
                    }
                }

                this.sendSuccessToSocket(AdminEventType.ConfigRequest, socket, {
                    config: appSettings,
                    systemEnvironmentVariables: global.omnihive.appSettings.environmentVariables.filter(
                        (variable: EnvironmentVariable) => variable.isSystem
                    ),
                });
            });

            // Admin Event : Config Save
            socket.on(AdminEventType.ConfigSaveRequest, async (message: AdminRequest<{ config: AppSettings }>) => {
                if (!this.checkRequest(AdminEventType.ConfigSaveRequest, message, socket)) {
                    return;
                }

                try {
                    if (IsHelper.isNullOrUndefined(message.data) || IsHelper.isNullOrUndefined(message.data.config)) {
                        this.sendErrorToSocket(
                            AdminEventType.ConfigSaveRequest,
                            socket,
                            "Invalid Configuration Submitted"
                        );
                    }

                    const settings: AppSettings = ObjectHelper.createStrict<AppSettings>(
                        AppSettings,
                        message.data?.config
                    );

                    const configWorker: IConfigWorker | undefined = global.omnihive.getWorker<IConfigWorker>(
                        HiveWorkerType.Config
                    );

                    if (IsHelper.isNullOrUndefined(configWorker)) {
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
                    if (!IsHelper.isNullOrUndefined(this.ioEmitter) && clusterEnabled) {
                        this.ioEmitter.serverSideEmit(AdminEventType.ServerResetRequest, message);
                        return;
                    }

                    ipc.connectTo(global.omnihive.commandLineArgs.ipcServerId, () => {
                        ipc.of[global.omnihive.commandLineArgs.ipcServerId].on("connect", () => {
                            ipc.of[global.omnihive.commandLineArgs.ipcServerId].emit("omnihive.reboot");
                        });
                    });
                }, 2000);
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

                socket.join(`${serverGroupId}-${AdminRoomType.Log}`);
                this.sendSuccessToSocket(AdminEventType.StartLogRequest, socket, { verified: true });
            });

            // Admin Event : Stop Log
            socket.on(AdminEventType.StopLogRequest, (message: AdminRequest) => {
                if (!this.checkRequest(AdminEventType.StopLogRequest, message, socket)) {
                    return;
                }

                socket.leave(`${serverGroupId}-${AdminRoomType.Log}`);
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

        this.logWorker?.write(OmniHiveLogLevel.Info, `Admin server listening on port ${adminPortNumber}...`);
    };

    private checkRequest = (adminEvent: AdminEventType, request: AdminRequest, socket?: socketio.Socket): boolean => {
        if (
            IsHelper.isEmptyStringOrWhitespace(request.serverGroupId) ||
            request.serverGroupId !== global.omnihive.getEnvironmentVariable<string>("OH_ADMIN_SERVER_GROUP_ID")
        ) {
            return false;
        }

        if (
            !IsHelper.isEmptyStringOrWhitespace(request.adminPassword) &&
            !IsHelper.isEmptyStringOrWhitespace(request.serverGroupId) &&
            request.adminPassword === global.omnihive.getEnvironmentVariable<string>("OH_ADMIN_PASSWORD") &&
            request.serverGroupId === global.omnihive.getEnvironmentVariable<string>("OH_ADMIN_SERVER_GROUP_ID")
        ) {
            return true;
        }

        this.logWorker?.write(
            OmniHiveLogLevel.Warn,
            `Admin client register error using password ${request.adminPassword}...`
        );

        if (!IsHelper.isNullOrUndefined(socket)) {
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
        const serverGroupId = global.omnihive.getEnvironmentVariable<string>("OH_ADMIN_SERVER_GROUP_ID");

        if (IsHelper.isNullOrUndefined(serverGroupId)) {
            throw new Error("Server group ID is undefined");
        }

        const adminResponse: AdminResponse = {
            serverGroupId,
            requestComplete: false,
            requestError: errorMessage,
        };

        socket.emit(this.getResponseEventNameFromRequest(adminEvent), adminResponse);
    };

    private sendSuccessToSocket = (adminEvent: AdminEventType, socket: socketio.Socket, message: any): void => {
        const serverGroupId = global.omnihive.getEnvironmentVariable<string>("OH_ADMIN_SERVER_GROUP_ID");

        if (IsHelper.isNullOrUndefined(serverGroupId)) {
            throw new Error("Server group ID is undefined");
        }

        const adminResponse: AdminResponse = {
            serverGroupId,
            requestComplete: true,
            requestError: undefined,
            data: message,
        };

        socket.emit(this.getResponseEventNameFromRequest(adminEvent), adminResponse);
    };
}
