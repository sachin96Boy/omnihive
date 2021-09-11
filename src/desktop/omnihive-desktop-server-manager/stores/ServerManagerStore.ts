import {
    AdminEventType,
    AdminRequest,
    AdminResponse,
    IsHelper,
    RegisteredUrl,
    ServerStatus,
} from "@withonevision/omnihive-core-cjs/index";
import { AppSettings } from "@withonevision/omnihive-desktop-core/models/AppSettings";
import { RegisteredClientModel } from "@withonevision/omnihive-desktop-core/models/RegisteredClientModel";
import { RegisteredServerModel } from "@withonevision/omnihive-desktop-core/models/RegisteredServerModel";
import produce from "immer";
import socketio from "socket.io-client";
import create from "zustand";

export type ServerManagerStoreType = {
    appSettings: AppSettings;
    addServer: (registeredServer: RegisteredServerModel) => void;
    editServer: (oldServerLabel: string, registeredServer: RegisteredServerModel) => void;
    registeredClients: RegisteredClientModel[];
    registeredServers: () => RegisteredServerModel[];
    removeAllServers: () => void;
    removeServer: (serverLabel: string) => void;
    setAppSettings: (newAppSettings: AppSettings) => void;
    subscribeToServer: (serverLabel: string, provideFeedback?: boolean) => void;
    unsubscribeFromServer: (serverLabel: string) => void;
};

export const useServerManagerStore = create<ServerManagerStoreType>((set, get) => ({
    appSettings: new AppSettings(),
    setAppSettings: (newAppSettings: AppSettings): void =>
        set(
            produce((state: ServerManagerStoreType) => {
                state.appSettings = newAppSettings;
            })
        ),
    addServer: (registeredServer: RegisteredServerModel): void =>
        set(
            produce((state: ServerManagerStoreType) => {
                state.appSettings.registeredServers.push(registeredServer);
                state.subscribeToServer(registeredServer.label);
            })
        ),
    editServer: (oldServerLabel: string, registeredServer: RegisteredServerModel): void =>
        set(
            produce((state: ServerManagerStoreType) => {
                state.removeServer(oldServerLabel);
                state.addServer(registeredServer);
            })
        ),
    removeAllServers: (): void =>
        set(
            produce((state: ServerManagerStoreType) => {
                const allServers = JSON.parse(JSON.stringify(state.appSettings.registeredServers));

                allServers?.forEach((server: RegisteredServerModel) => {
                    state.removeServer(server.label);
                });
            })
        ),
    registeredClients: [],
    registeredServers: (): RegisteredServerModel[] => {
        if (
            IsHelper.isNullOrUndefined(get().appSettings) ||
            IsHelper.isNullOrUndefined(get().appSettings.registeredServers)
        ) {
            return [];
        }

        return get().appSettings.registeredServers;
    },
    removeServer: (serverLabel: string): void =>
        set(
            produce((state: ServerManagerStoreType) => {
                state.appSettings.registeredServers = state.appSettings.registeredServers.filter(
                    (server: RegisteredServerModel) => server.label !== serverLabel
                );
                state.unsubscribeFromServer(serverLabel);
            })
        ),
    subscribeToServer: (serverLabel: string, provideFeedback: boolean = false): void =>
        set(
            produce((state: ServerManagerStoreType) => {
                let errorNotificationCount: number = 0;
                const server: RegisteredServerModel | undefined = state.appSettings.registeredServers.find(
                    (server: RegisteredServerModel) => server.label === serverLabel
                );

                if (IsHelper.isNullOrUndefined(server)) {
                    return;
                }

                state.unsubscribeFromServer(serverLabel);

                const url: URL = new URL(server.address);
                const socket = socketio(`${url.origin}/${server.serverGroupId}`, {
                    path: `${url.pathname === "/" ? "" : url.pathname}/socket.io`,
                    transports: ["websocket"],
                });

                socket.on("connect", () => {
                    const eventRequest: AdminRequest = {
                        adminPassword: server.adminPassword,
                        serverGroupId: server.serverGroupId,
                    };

                    socket.emit(AdminEventType.StatusRequest, eventRequest);

                    if (provideFeedback === true) {
                        errorNotificationCount = 0;
                    }
                });

                socket.on("connect_error", () => {
                    const server: RegisteredServerModel | undefined = state.appSettings.registeredServers.find(
                        (server: RegisteredServerModel) => server.label === serverLabel
                    );

                    if (IsHelper.isNullOrUndefined(server)) {
                        return;
                    }

                    const currentStatus: string = server.status;

                    if (currentStatus !== ServerStatus.Offline) {
                        server.status = ServerStatus.Offline;
                    }

                    if (provideFeedback === true && errorNotificationCount === 0) {
                        errorNotificationCount++;
                    }
                });

                socket.on("disconnect", () => {
                    const server: RegisteredServerModel | undefined = state.appSettings.registeredServers.find(
                        (server: RegisteredServerModel) => server.label === serverLabel
                    );

                    if (IsHelper.isNullOrUndefined(server)) {
                        return;
                    }

                    const currentStatus: string = server.status;

                    if (currentStatus !== ServerStatus.Offline) {
                        server.status = ServerStatus.Offline;
                    }

                    if (provideFeedback === true && errorNotificationCount === 0) {
                        errorNotificationCount++;
                    }
                });

                socket.on(AdminEventType.ServerResetResponse, (message: AdminRequest) => {
                    const server: RegisteredServerModel | undefined = state.appSettings.registeredServers.find(
                        (server: RegisteredServerModel) =>
                            server.label === serverLabel && server.serverGroupId === message.serverGroupId
                    );

                    if (IsHelper.isNullOrUndefined(server)) {
                        return;
                    }

                    server.status = ServerStatus.Offline;

                    setTimeout(() => {
                        state.subscribeToServer(serverLabel);
                    }, 3000);
                });

                socket.on(AdminEventType.RegisterResponse, (message: AdminResponse<{ verified: boolean }>) => {
                    const server: RegisteredServerModel | undefined = state.appSettings.registeredServers.find(
                        (server: RegisteredServerModel) =>
                            server.label === serverLabel && server.serverGroupId === message.serverGroupId
                    );

                    if (IsHelper.isNullOrUndefined(server)) {
                        return;
                    }

                    if (
                        !message.requestComplete ||
                        IsHelper.isNullOrUndefined(message.data) ||
                        !message.data.verified
                    ) {
                        server.status = ServerStatus.Error;
                        return;
                    }

                    const eventRequest: AdminRequest = {
                        adminPassword: server.adminPassword,
                        serverGroupId: server.serverGroupId,
                    };

                    socket.emit(AdminEventType.StatusRequest, eventRequest);
                });

                socket.on(
                    AdminEventType.StatusResponse,
                    (message: AdminResponse<{ serverStatus: ServerStatus; serverError: any }>) => {
                        const server: RegisteredServerModel | undefined = state.appSettings.registeredServers.find(
                            (server: RegisteredServerModel) =>
                                server.label === serverLabel && server.serverGroupId === message.serverGroupId
                        );

                        if (IsHelper.isNullOrUndefined(server)) {
                            return;
                        }

                        const currentStatus: string = server.status;

                        if (!message.requestComplete) {
                            if (currentStatus !== ServerStatus.Offline) {
                                server.status = ServerStatus.Offline;
                            }
                            return;
                        }

                        server.status = message.data?.serverStatus ?? ServerStatus.Unknown;

                        if (currentStatus !== server.status) {
                            socket.emit(AdminEventType.UrlListRequest, {
                                adminPassword: server.adminPassword,
                                serverGroupId: server.serverGroupId,
                            });
                        }
                    }
                );

                socket.on(AdminEventType.UrlListResponse, (message: AdminResponse<{ urls: RegisteredUrl[] }>) => {
                    const server: RegisteredServerModel | undefined = state.appSettings.registeredServers.find(
                        (server: RegisteredServerModel) =>
                            server.label === serverLabel && server.serverGroupId === message.serverGroupId
                    );

                    if (IsHelper.isNullOrUndefined(server)) {
                        return;
                    }

                    if (!message.requestComplete) {
                        server.urls = [];
                        return;
                    }

                    server.urls = message.data?.urls ?? [];
                });

                socket.connect();
                state.registeredClients.push({ serverLabel, socket });
            })
        ),
    unsubscribeFromServer: (serverLabel: string): void =>
        set(
            produce((state: ServerManagerStoreType) => {
                const client: RegisteredClientModel | undefined = state.registeredClients.find(
                    (client: RegisteredClientModel) => client.serverLabel === serverLabel
                );

                if (IsHelper.isNullOrUndefined(client) || IsHelper.isNullOrUndefined(client.socket)) {
                    return;
                }

                client.socket.off();
                client.socket.disconnect();
                client.socket = null;

                state.registeredClients = state.registeredClients.filter(
                    (client: RegisteredClientModel) => client.serverLabel !== serverLabel
                );
            })
        ),
}));
