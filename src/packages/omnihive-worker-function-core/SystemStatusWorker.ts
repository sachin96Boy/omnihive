/// <reference path="../../types/globals.omnihive.d.ts" />

import { IRestEndpointWorker } from "@withonevision/omnihive-core/interfaces/IRestEndpointWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-core/models/HiveWorkerBase";
import { RestEndpointExecuteResponse } from "@withonevision/omnihive-core/models/RestEndpointExecuteResponse";
import { serializeError } from "serialize-error";
import swaggerUi from "swagger-ui-express";

class SystemStatusRequest {
    adminPassword!: string;
}

export default class SystemStatusWorker extends HiveWorkerBase implements IRestEndpointWorker {
    constructor() {
        super();
    }

    public execute = async (_headers: any, _url: string, body: any): Promise<RestEndpointExecuteResponse> => {
        try {
            this.checkRequest(body);
            return {
                response: { status: global.omnihive.serverStatus, error: global.omnihive.serverError },
                status: 200,
            };
        } catch (e) {
            return { response: { error: serializeError(e) }, status: 400 };
        }
    };

    public getSwaggerDefinition = (): swaggerUi.JsonObject => {
        return {
            definitions: {
                GetStatusParameters: {
                    required: ["adminPassword"],
                    properties: {
                        adminPassword: {
                            type: "string",
                        },
                    },
                },
                GetStatusReturn: {
                    properties: {
                        serverStatus: {
                            type: "string",
                        },
                        serverError: {
                            type: "string",
                        },
                    },
                },
            },
            paths: {
                "/status": {
                    post: {
                        description: "Gets the OmniHive server status",
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
                                        $ref: "#/definitions/GetStatusParameters",
                                    },
                                },
                            },
                        },
                        responses: {
                            "200": {
                                description: "OmniHive Status Response",
                                content: {
                                    "application/json": {
                                        schema: {
                                            $ref: "#/definitions/GetStatusReturn",
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

    private checkRequest = (body: any | undefined) => {
        if (!body) {
            throw new Error("Request Denied");
        }

        const paramsStructured: SystemStatusRequest = this.checkObjectStructure<SystemStatusRequest>(
            SystemStatusRequest,
            body
        );

        if (!paramsStructured.adminPassword || paramsStructured.adminPassword === "") {
            throw new Error(`Request Denied`);
        }

        if (paramsStructured.adminPassword !== this.serverSettings.config.adminPassword) {
            throw new Error(`Request Denied`);
        }
    };
}
