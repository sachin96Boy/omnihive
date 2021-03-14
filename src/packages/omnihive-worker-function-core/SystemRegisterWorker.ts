import { IRestEndpointWorker } from "@withonevision/omnihive-core/interfaces/IRestEndpointWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-core/models/HiveWorkerBase";
import { RestEndpointExecuteResponse } from "@withonevision/omnihive-core/models/RestEndpointExecuteResponse";
import { serializeError } from "serialize-error";
import swaggerUi from "swagger-ui-express";

class SystemRegisterRequest {
    adminPassword!: string;
}

export default class SystemRegisterWorker extends HiveWorkerBase implements IRestEndpointWorker {
    constructor() {
        super();
    }

    public execute = async (_headers: any, _url: string, body: any): Promise<RestEndpointExecuteResponse> => {
        try {
            this.checkRequest(_headers, body);
            return { response: { verified: true }, status: 200 };
        } catch (e) {
            return { response: { error: serializeError(e) }, status: 400 };
        }
    };

    public getSwaggerDefinition = (): swaggerUi.JsonObject | undefined => {
        return {
            definitions: {
                RegisterParameters: {
                    required: ["adminPassword"],
                    properties: {
                        adminPassword: {
                            type: "string",
                        },
                    },
                },
            },
            paths: {
                "/register": {
                    post: {
                        description: "Checks if your register server settings are correct",
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
                                        $ref: "#/definitions/RegisterParameters",
                                    },
                                },
                            },
                        },
                        responses: {
                            "200": {
                                description: "OmniHive Register Response",
                                content: {
                                    "text/plain": {
                                        schema: {
                                            type: "boolean",
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

    private checkRequest = (_headers: any, body: any | undefined) => {
        if (!body) {
            throw new Error("Request Denied");
        }

        const paramsStructured: SystemRegisterRequest = this.checkObjectStructure<SystemRegisterRequest>(
            SystemRegisterRequest,
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
