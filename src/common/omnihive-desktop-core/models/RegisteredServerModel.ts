import { ServerStatus } from "@withonevision/omnihive-core-cjs/enums/ServerStatus";
import { RegisteredUrl } from "@withonevision/omnihive-core-cjs/models/RegisteredUrl";

export type RegisteredServerModel = {
    address: string;
    adminPassword: string;
    serverGroupId: string;
    label: string;
    status: ServerStatus;
    urls: RegisteredUrl[];
};
