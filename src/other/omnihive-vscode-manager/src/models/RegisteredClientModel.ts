import { Socket } from "socket.io-client";

export type RegisteredClientModel = {
    serverLabel: string;
    socket: Socket | null | undefined;
};
