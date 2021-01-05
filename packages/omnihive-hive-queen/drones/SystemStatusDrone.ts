import { AwaitHelper } from "@withonevision/omnihive-hive-common/helpers/AwaitHelper";
import { IRestDrone } from "@withonevision/omnihive-hive-queen/interfaces/IRestDrone";
import { DroneBase } from "@withonevision/omnihive-hive-queen/models/DroneBase";
import * as core from "express-serve-static-core";
import { QueenStore } from "../stores/QueenStore";
import swaggerUi from "swagger-ui-express";
import { ITokenWorker } from "@withonevision/omnihive-hive-worker/interfaces/ITokenWorker";
import { HiveWorkerFactory } from "@withonevision/omnihive-hive-worker/HiveWorkerFactory";
import { HiveWorkerType } from "@withonevision/omnihive-hive-common/enums/HiveWorkerType";

export default class SystemStatusDrone extends DroneBase implements IRestDrone {

    public async register(app: core.Express, restRoot: string): Promise<void> {

        app.post(`${restRoot}/status`, async (req: core.Request, res: core.Response) => {
            try {
                await AwaitHelper.execute<void>(this.checkRequest(req));
                const accessToken: string | undefined = req.headers.ohAccess?.toString();

                const tokenWorker: ITokenWorker | undefined = await AwaitHelper.execute<ITokenWorker | undefined>(
                    HiveWorkerFactory.getInstance().getHiveWorker<ITokenWorker | undefined>(HiveWorkerType.Token));

                if (!accessToken || !tokenWorker) {
                    throw new Error("Request Denied");
                }
                
                const verified: boolean = await AwaitHelper.execute<boolean>(tokenWorker.verify(accessToken));

                if (!verified) {
                    throw new Error("Invalid Access Token");
                }

                res.setHeader('Content-Type', 'application/json');
                return res.status(200).json(QueenStore.getInstance().status);
            } catch (e) {
                return res.status(400).send(e.message);
            }
        });
    }

    private checkRequest = async (req: core.Request) => {

        if (!req.body) {
            throw new Error(`Request Denied`);
        }

        if (!req.headers.ohaccess) {
            throw new Error(`Request Denied`);
        }

        if (!req.body.adminPassword || req.body.adminPassword === "") {
            throw new Error(`Request Denied`);
        }

        if (req.body.adminPassword !== QueenStore.getInstance().settings.server.adminPassword) {
            throw new Error(`Request Denied`);
        }
    }

    public getSwaggerDefinition = (): swaggerUi.JsonObject => {
        return {
            "definitions": {
                "GetStatusParameters": {
                    "required": [
                        "adminPassword"
                    ],
                    "properties": {
                        "adminPassword": {
                            "type": "string"
                        }
                    }
                },
                "GetStatusReturn": {
                    "properties": {
                        "serverStatus": {
                            "type": "string"
                        },
                        "serverError": {
                            "type": "string"
                        }
                    }
                }
            },
            "paths": {
                "/status": {
                    "post": {
                        "description": "Gets the OmniHive server status",
                        "tags": [
                            {
                                "name": "System"
                            }
                        ],
                        "parameters": [
                            {
                                "in": "header",
                                "name": "ohaccess",
                                "required": true,
                                "schema": {
                                    "type": "string"
                                }
                            }
                        ],
                        "requestBody": {
                            "required": true,
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "$ref": "#/definitions/GetStatusParameters"
                                    }
                                }
                            }
                        },
                        "responses": {
                            "200": {
                                "description": "OmniHive Check Settings Response",
                                "content": {
                                    "application/json": {
                                        "schema": {
                                            "$ref": "#/definitions/GetStatusReturn"
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