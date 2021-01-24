import { HiveWorkerType } from "@withonevision/omnihive-common/enums/HiveWorkerType";
import { AwaitHelper } from "@withonevision/omnihive-common/helpers/AwaitHelper";
import { IRestEndpointWorker } from "@withonevision/omnihive-common/interfaces/IRestEndpointWorker";
import { ITokenWorker } from "@withonevision/omnihive-common/interfaces/ITokenWorker";
import { HiveWorker } from "@withonevision/omnihive-common/models/HiveWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-common/models/HiveWorkerBase";
import { HiveWorkerMetadataRestFunction } from "@withonevision/omnihive-common/models/HiveWorkerMetadataRestFunction";
import { CommonStore } from "@withonevision/omnihive-common/stores/CommonStore";
import express from "express";
import swaggerUi from "swagger-ui-express";

export default class SystemAccessTokenWorker extends HiveWorkerBase implements IRestEndpointWorker {
    private tokenWorker!: ITokenWorker;
    private metadata!: HiveWorkerMetadataRestFunction;

    constructor() {
        super();
    }

    public async init(config: HiveWorker): Promise<void> {
        await AwaitHelper.execute<void>(super.init(config));
        this.metadata = this.checkMetadata<HiveWorkerMetadataRestFunction>(
            HiveWorkerMetadataRestFunction,
            config.metadata
        );
    }

    public async register(app: express.Express, restRoot: string): Promise<void> {
        const tokenWorker: ITokenWorker | undefined = await AwaitHelper.execute<ITokenWorker | undefined>(
            CommonStore.getInstance().getHiveWorker<ITokenWorker>(HiveWorkerType.Token)
        );

        if (!tokenWorker) {
            throw new Error("Token Worker cannot be found");
        }

        this.tokenWorker = tokenWorker;

        app.post(`${restRoot}${this.metadata.methodUrl}`, async (req: express.Request, res: express.Response) => {
            try {
                await AwaitHelper.execute<void>(this.checkRequest(req));
                const token = await AwaitHelper.execute<string>(this.tokenWorker.get());
                return res.send(token);
            } catch (e) {
                return res.status(400).send(e.message);
            }
        });
    }

    private checkRequest = async (req: express.Request) => {
        if (!req.body) {
            throw new Error(`Request body incorrectly formed`);
        }

        if (!req.body.clientId || req.body.clientId === "") {
            throw new Error(`A client ID must be provided`);
        }

        if (!req.body.clientSecret || req.body.clientSecret === "") {
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
