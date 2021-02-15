import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { IRestEndpointWorker } from "@withonevision/omnihive-core/interfaces/IRestEndpointWorker";
import { ITokenWorker } from "@withonevision/omnihive-core/interfaces/ITokenWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-core/models/HiveWorkerBase";
import { RestEndpointExecuteResponse } from "@withonevision/omnihive-core/models/RestEndpointExecuteResponse";
import { serializeError } from "serialize-error";
import swaggerUi from "swagger-ui-express";
class SystemAccessTokenRequest {
    clientId!: string;
    clientSecret!: string;
}

export default class SystemAccessTokenWorker extends HiveWorkerBase implements IRestEndpointWorker {
    private tokenWorker!: ITokenWorker;

    constructor() {
        super();
    }

    public execute = async (_headers: any, _url: string, body: any): Promise<RestEndpointExecuteResponse> => {
        const tokenWorker: ITokenWorker | undefined = this.getWorker<ITokenWorker>(HiveWorkerType.Token);
        if (!tokenWorker) {
            throw new Error("Token Worker cannot be found");
        }

        this.tokenWorker = tokenWorker;

        try {
            this.checkRequest(body);
            const token = await AwaitHelper.execute<string>(this.tokenWorker.get());
            return { response: { token: token }, status: 200 };
        } catch (e) {
            return { response: { error: serializeError(e) }, status: 400 };
        }
    };

    public getSwaggerDefinition = (): swaggerUi.JsonObject | undefined => {
        return {
            definitions: {
                GetAccessTokenParameters: {
                    required: ["clientId", "clientSecret"],
                    properties: {
                        clientId: {
                            type: "string",
                        },
                        clientSecret: {
                            type: "string",
                        },
                    },
                },
            },
            paths: {
                "/accessToken": {
                    post: {
                        description: "Retrieve an OmniHive access token",
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
                                        $ref: "#/definitions/GetAccessTokenParameters",
                                    },
                                },
                            },
                        },
                        responses: {
                            "200": {
                                description: "OmniHive access token",
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

    private checkRequest = (body: any | undefined) => {
        if (!body) {
            throw new Error("Request must have parameters");
        }

        const paramsStructured: SystemAccessTokenRequest = this.checkObjectStructure<SystemAccessTokenRequest>(
            SystemAccessTokenRequest,
            body
        );

        if (!paramsStructured.clientId || paramsStructured.clientId === "") {
            throw new Error(`A client ID must be provided`);
        }

        if (!paramsStructured.clientSecret || paramsStructured.clientSecret === "") {
            throw new Error(`A client secret must be provided`);
        }

        if (
            !this.tokenWorker ||
            !this.tokenWorker.config.metadata ||
            !this.tokenWorker.config.metadata.clientId ||
            !this.tokenWorker.config.metadata.clientSecret
        ) {
            throw new Error("A token worker cannot be found");
        }
    };
}
