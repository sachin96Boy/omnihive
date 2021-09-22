import { ServerStatus } from "@withonevision/omnihive-core/enums/ServerStatus";
import { RegisteredUrl } from "@withonevision/omnihive-core/models/RegisteredUrl";

export type RegisteredServerModel = {
    address: string;
    adminPassword: string;
    serverGroupId: string;
    label: string;
    status: ServerStatus;
    urls: RegisteredUrl[];
};
