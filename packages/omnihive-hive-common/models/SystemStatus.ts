import { ServerStatus } from "../enums/ServerStatus";

export class SystemStatus {
    serverStatus: ServerStatus = ServerStatus.Unknown;
    serverError: any = {};
}