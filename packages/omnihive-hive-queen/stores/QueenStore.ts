import { ServerStatus } from "@withonevision/omnihive-hive-common/enums/ServerStatus";
import { HiveAccount } from "@withonevision/omnihive-hive-common/models/HiveAccount";
import { SystemSettings } from "@withonevision/omnihive-hive-common/models/SystemSettings";
import { SystemStatus } from "@withonevision/omnihive-hive-common/models/SystemStatus";
import { serializeError } from "serialize-error";

export class QueenStore {

    private static instance: QueenStore;

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    private constructor() { }

    public static getInstance = (): QueenStore => {
        if (!QueenStore.instance) {
            QueenStore.instance = new QueenStore();
        }

        return QueenStore.instance;
    }

    public static getNew = (): QueenStore => {
        return new QueenStore();
    }

    public account: HiveAccount = new HiveAccount();
    public settings: SystemSettings = new SystemSettings();

    private _status: SystemStatus = new SystemStatus();

    public get status(): SystemStatus {
        return this._status;
    }

    public changeSystemStatus = (serverStatus: ServerStatus, error?: Error): void => {

        const systemStatus: SystemStatus = new SystemStatus();
        systemStatus.serverStatus = serverStatus;

        if (error) {
            systemStatus.serverError = serializeError(error);
        } else {
            systemStatus.serverError = {};
        }

        this._status = systemStatus;
    }
}
