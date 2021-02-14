import { ServerStatus } from "@withonevision/omnihive-core/enums/ServerStatus";
import { RegisteredUrl } from "@withonevision/omnihive-core/models/RegisteredUrl";
import express from "express";
import { Server } from "http";

export class NodeGlobalObject {
    appServer!: express.Express;
    serverError: any = {};
    serverStatus: ServerStatus = ServerStatus.Unknown;
    registeredUrls: RegisteredUrl[] = [];
    webServer: Server | undefined = undefined;
}
