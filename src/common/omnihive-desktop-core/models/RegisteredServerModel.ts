import { RegisteredUrl, ServerStatus } from "@withonevision/omnihive-core-cjs";

export type RegisteredServerModel = {
    address: string;
    adminPassword: string;
    serverGroupId: string;
    label: string;
    status: ServerStatus;
    urls: RegisteredUrl[];
};
