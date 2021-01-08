import { HiveWorkerType } from "@withonevision/omnihive-hive-common/enums/HiveWorkerType";
import { AwaitHelper } from "@withonevision/omnihive-hive-common/helpers/AwaitHelper";
import { HiveWorker } from "@withonevision/omnihive-hive-common/models/HiveWorker";
import { HiveWorkerFactory } from "@withonevision/omnihive-hive-worker/HiveWorkerFactory";
import { IRestEndpointWorker } from "@withonevision/omnihive-hive-worker/interfaces/IRestEndpointWorker";
import { ITokenWorker } from "@withonevision/omnihive-hive-worker/interfaces/ITokenWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-hive-worker/models/HiveWorkerBase";
import { HiveWorkerMetadataRestFunction } from "@withonevision/omnihive-hive-worker/models/HiveWorkerMetadataRestFunction";
import * as core from "express-serve-static-core";
import swaggerUi from "swagger-ui-express";

export default class SystemAccessTokenWorker extends HiveWorkerBase implements IRestEndpointWorker {

    private tokenWorker!: ITokenWorker;
    private metadata!: HiveWorkerMetadataRestFunction;

    constructor() {
        super();
    }

    public async init(config: HiveWorker): Promise<void> {
        await AwaitHelper.execute<void>(super.init(config));
        this.metadata = this.hiveWorkerHelper.checkMetadata<HiveWorkerMetadataRestFunction>(HiveWorkerMetadataRestFunction, config.metadata);
    }

    public async afterInit(): Promise<void> {
        const tokenWorker: ITokenWorker | undefined = await AwaitHelper.execute<ITokenWorker | undefined>(
            HiveWorkerFactory.getInstance().getHiveWorker<ITokenWorker>(HiveWorkerType.Token));

        if (!tokenWorker) {
            throw new Error("Token Worker cannot be found");
        }

        this.tokenWorker = tokenWorker;
    }

    public async register(app: core.Express, restRoot: string): Promise<void> {
        app.post(`${restRoot}${this.metadata.methodUrl}`, async (req: core.Request, res: core.Response) => {
            try {
                await AwaitHelper.execute<void>(this.checkRequest(req));
                const token = await AwaitHelper.execute<string>(this.tokenWorker.get());
                return res.send(token);
            } catch (e) {
                return res.status(400).send(e.message);
            }
        });
    }

    private checkRequest = async (req: core.Request) => {

        if (!req.body) {
            throw new Error(`Request body incorrectly formed`);
        }

        if (!req.body.clientId || req.body.clientId === "") {
            throw new Error(`A client ID must be provided`);
        }

        if (!req.body.clientSecret || req.body.clientSecret === "") {
            throw new Error(`A client secret must be provided`);
        }

        if (!this.tokenWorker || !this.tokenWorker.config.metadata || !this.tokenWorker.config.metadata.clientId || !this.tokenWorker.config.metadata.clientSecret) {
            throw new Error("A token worker cannot be found");
        }
    }

    public getSwaggerDefinition = (): swaggerUi.JsonObject | undefined => {
        return {
            "definitions": {
                "GetAccessTokenParameters": {
                    "required": [
                        "clientId",
                        "clientSecret"
                    ],
                    "properties": {
                        "clientId": {
                            "type": "string"
                        },
                        "clientSecret": {
                            "type": "string"
                        }
                    }
                }
            },
            "paths": {
                "/accessToken": {
                    "post": {
                        "description": "Retrieve an OmniHive access token",
                        "tags": [
                            {
                                "name": "System",
                            }
                        ],
                        "requestBody": {
                            "required": true,
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "$ref": "#/definitions/GetAccessTokenParameters"
                                    }
                                }
                            }
                        },
                        "responses": {
                            "200": {
                                "description": "OmniHive access token",
                                "content": {
                                    "text/plain": {
                                        "schema": {
                                            "type": "string"
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}