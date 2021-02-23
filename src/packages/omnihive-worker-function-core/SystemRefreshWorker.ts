import { IRestEndpointWorker } from "@withonevision/omnihive-core/interfaces/IRestEndpointWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-core/models/HiveWorkerBase";
import { RestEndpointExecuteResponse } from "@withonevision/omnihive-core/models/RestEndpointExecuteResponse";
import { serializeError } from "serialize-error";
import swaggerUi from "swagger-ui-express";

class SystemRefreshRequest {
    adminPassword!: string;
}

export default class SystemRefreshWorker extends HiveWorkerBase implements IRestEndpointWorker {
    constructor() {
        super();
    }

    public execute = async (_headers: any, _url: string, body: any): Promise<RestEndpointExecuteResponse> => {
        try {
            this.checkRequest(body);
            return { response: { message: "Server Refresh/Reset Initiated" }, status: 200 };
        } catch (e) {
            return { response: { error: serializeError(e) }, status: 400 };
        }
    };

    public getSwaggerDefinition = (): swaggerUi.JsonObject => {
        return {
            definitions: {
                ServerResetParameters: {
                    required: ["adminPassword"],
                    properties: {
                        adminPassword: {
                            type: "string",
                        },
                    },
                },
            },
            paths: {
                "/refresh": {
                    post: {
                        description: "Resets your OmniHive Server",
                        tags: [
                            {
                                name: "System",
                            },
                        ],
                        requestBody: {
                            required: true,
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/definitions/ServerResetParameters",
                                    },
                                },
                            },
                        },
                        responses: {
                            "200": {
                                description: "OmniHive Refresh Response",
                                content: {
                                    "text/plain": {
                                        schema: {
                                            type: "string",
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        };
    };

    private checkRequest = (params: any | undefined) => {
        if (!params) {
            throw new Error("Request Denied");
        }

        const paramsStructured: SystemRefreshRequest = this.checkObjectStructure<SystemRefreshRequest>(
            SystemRefreshRequest,
            params
        );

        if (!paramsStructured.adminPassword || paramsStructured.adminPassword === "") {
            throw new Error(`Request Denied`);
        }

        if (paramsStructured.adminPassword !== this.serverSettings.config.adminPassword) {
            throw new Error(`Request Denied`);
        }
    };
}
