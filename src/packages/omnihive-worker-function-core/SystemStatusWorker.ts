/// <reference path="../../types/globals.omnihive.d.ts" />

import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { IRestEndpointWorker } from "@withonevision/omnihive-core/interfaces/IRestEndpointWorker";
import { ITokenWorker } from "@withonevision/omnihive-core/interfaces/ITokenWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-core/models/HiveWorkerBase";
import { RestEndpointExecuteResponse } from "@withonevision/omnihive-core/models/RestEndpointExecuteResponse";
import { serializeError } from "serialize-error";
import swaggerUi from "swagger-ui-express";

class SystemStatusRequest {
    adminPassword!: string;
}

export default class SystemStatusWorker extends HiveWorkerBase implements IRestEndpointWorker {
    private tokenWorker!: ITokenWorker;

    constructor() {
        super();
    }

    public execute = async (headers: any, _url: string, body: any): Promise<RestEndpointExecuteResponse> => {
        const tokenWorker: ITokenWorker | undefined = this.getWorker<ITokenWorker>(HiveWorkerType.Token);

        if (!tokenWorker) {
            throw new Error("Token Worker cannot be found");
        }

        this.tokenWorker = tokenWorker;

        try {
            this.checkRequest(headers, body);
            const accessToken: string | undefined = headers.ohAccess?.toString();
            const verified: boolean = await AwaitHelper.execute<boolean>(this.tokenWorker.verify(accessToken ?? ""));

            if (!verified) {
                throw new Error("Invalid Access Token");
            }
            return { response: global.omnihive.serverStatus, status: 200 };
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
                        parameters: [
                            {
                                in: "header",
                                name: "ohaccess",
                                required: true,
                                schema: {
                                    type: "string",
                                },
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
                                description: "OmniHive Check Settings Response",
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

    private checkRequest = (headers: any, body: any | undefined) => {
        if (!headers || !body) {
            throw new Error("Request Denied");
        }

        const paramsStructured: SystemStatusRequest = this.checkObjectStructure<SystemStatusRequest>(
            SystemStatusRequest,
            body
        );

        if (!headers.ohaccess) {
            throw new Error(`Request Denied`);
        }

        if (!paramsStructured.adminPassword || paramsStructured.adminPassword === "") {
            throw new Error(`Request Denied`);
        }

        if (paramsStructured.adminPassword !== this.serverSettings.config.adminPassword) {
            throw new Error(`Request Denied`);
        }
    };
}
