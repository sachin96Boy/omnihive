/// <reference path="../../../types/globals.omnihive.d.ts" />

import { OmniHiveLogLevel } from "@withonevision/omnihive-core/enums/OmniHiveLogLevel";
import { StringHelper } from "@withonevision/omnihive-core/helpers/StringHelper";
import * as socketio from "socket.io";
import * as socketioClient from "socket.io-client";
import { LogService } from "./LogService";
import { ServerService } from "./ServerService";

export class AdminService {
    public run = async () => {
        const logService: LogService = new LogService();

        logService.write(
            OmniHiveLogLevel.Info,
            `Setting up admin server on port ${global.omnihive.serverSettings.config.adminPortNumber}...`
        );

        global.omnihive.adminServerClient = socketioClient.io(
            `${global.omnihive.serverSettings.config.rootUrl}:${global.omnihive.serverSettings.config.adminPortNumber}`
        );

        global.omnihive.adminServer.listen(global.omnihive.serverSettings.config.adminPortNumber);

        global.omnihive.adminServer.once("connection", (socket: socketio.Socket) => {
            socket.on("register", (data: { adminPassword: string }) => {
                if (
                    !data ||
                    !data.adminPassword ||
                    StringHelper.isNullOrWhiteSpace(data.adminPassword) ||
                    data.adminPassword !== global.omnihive.serverSettings.config.adminPassword
                ) {
                    socket.emit("register", { socketError: true });
                }

                socket.emit("register", { verified: true });
            });

            socket.on("status", (data: { adminPassword: string }) => {
                if (
                    !data ||
                    !data.adminPassword ||
                    StringHelper.isNullOrWhiteSpace(data.adminPassword) ||
                    data.adminPassword !== global.omnihive.serverSettings.config.adminPassword
                ) {
                    socket.emit("status", { socketError: true });
                }

                socket.emit("status", { status: global.omnihive.serverStatus, error: global.omnihive.serverError });
            });

            socket.on("urls", (data: { adminPassword: string }) => {
                if (
                    !data ||
                    !data.adminPassword ||
                    StringHelper.isNullOrWhiteSpace(data.adminPassword) ||
                    data.adminPassword !== global.omnihive.serverSettings.config.adminPassword
                ) {
                    socket.emit("status", { socketError: true });
                }

                socket.emit("urls", { urls: global.omnihive.registeredUrls });
            });
        });

        global.omnihive.adminServerClient.on("refresh", (data: { refresh?: boolean }) => {
            if (!data || !data.refresh) {
                const serverService: ServerService = new ServerService();
                serverService.run();
            }
        });

        logService.write(
            OmniHiveLogLevel.Info,
            `Admin server listening on port ${global.omnihive.serverSettings.config.adminPortNumber}...`
        );
    };
}
