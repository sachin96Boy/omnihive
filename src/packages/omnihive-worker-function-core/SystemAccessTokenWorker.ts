import { IRestEndpointWorker } from "@withonevision/omnihive-core/interfaces/IRestEndpointWorker";
import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { ITokenWorker } from "@withonevision/omnihive-core/interfaces/ITokenWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-core/models/HiveWorkerBase";
import { CommonStore } from "@withonevision/omnihive-core/stores/CommonStore";
import swaggerUi from "swagger-ui-express";
import { serializeError } from "serialize-error";

class SystemAccessTokenRequest {
    clientId!: string;
    clientSecret!: string;
}

export default class SystemAccessTokenWorker extends HiveWorkerBase implements IRestEndpointWorker {
    private tokenWorker!: ITokenWorker;

    constructor() {
        super();
    }

    public async execute(_headers: any, params?: any): Promise<[{} | undefined, number]> {
        const tokenWorker: ITokenWorker | undefined = await AwaitHelper.execute<ITokenWorker | undefined>(
            CommonStore.getInstance().getHiveWorker<ITokenWorker>(HiveWorkerType.Token)
        );

        if (!tokenWorker) {
            throw new Error("Token Worker cannot be found");
        }

        this.tokenWorker = tokenWorker;

        try {
            await AwaitHelper.execute<void>(this.checkRequest(params));
            const token = await AwaitHelper.execute<string>(this.tokenWorker.get());
            return [{ token: token }, 200];
        } catch (e) {
            return [{ error: serializeError(e) }, 400];
        }
    }

    private checkRequest = async (params: any | undefined) => {
        if (!params) {
            throw new Error("Request must have parameters");
        }

        const paramsStructured: SystemAccessTokenRequest = this.checkObjectStructure<SystemAccessTokenRequest>(
            SystemAccessTokenRequest,
            params
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
}
