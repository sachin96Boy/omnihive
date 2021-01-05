import { AwaitHelper } from "@withonevision/omnihive-hive-common/helpers/AwaitHelper";
import { IRestDrone } from "@withonevision/omnihive-hive-queen/interfaces/IRestDrone";
import { DroneBase } from "@withonevision/omnihive-hive-queen/models/DroneBase";
import { ITokenWorker } from "@withonevision/omnihive-hive-worker/interfaces/ITokenWorker";
import { HiveWorkerType } from "@withonevision/omnihive-hive-common/enums/HiveWorkerType";
import * as core from "express-serve-static-core";
import { HiveWorkerFactory } from "@withonevision/omnihive-hive-worker/HiveWorkerFactory";
import swaggerUi from "swagger-ui-express";

export default class SystemAccessTokenDrone extends DroneBase implements IRestDrone {

    public async register(app: core.Express, restRoot: string): Promise<void> {

        app.post(`${restRoot}/accessToken`, async (req: core.Request, res: core.Response) => {
            try {

                const tokenHiveWorker: ITokenWorker | undefined = await AwaitHelper.execute<ITokenWorker | undefined>(
                    HiveWorkerFactory.getInstance().getHiveWorker<ITokenWorker>(HiveWorkerType.Token));

                if (!tokenHiveWorker) {
                    throw new Error("Token Drone cannot be found");
                }

                await AwaitHelper.execute<void>(this.checkRequest(req, tokenHiveWorker));
                const token = await AwaitHelper.execute<string>(tokenHiveWorker.get());
                return res.send(token);
            } catch (e) {
                return res.status(400).send(e.message);
            }
        });
    }

    private checkRequest = async (req: core.Request, hiveWorker: ITokenWorker) => {

        if (!req.body) {
            throw new Error(`Request body incorrectly formed`);
        }

        if (!req.body.clientId || req.body.clientId === "") {
            throw new Error(`A client ID must be provided`);
        }

        if (!req.body.clientSecret || req.body.clientSecret === "") {
            throw new Error(`A client secret must be provided`);
        }

        if (!hiveWorker || !hiveWorker.config.metadata || !hiveWorker.config.metadata.clientId || !hiveWorker.config.metadata.clientSecret) {
            throw new Error("A token worker cannot be found");
        }
    }

    public getSwaggerDefinition = (): swaggerUi.JsonObject => {
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