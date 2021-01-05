import { AwaitHelper } from "@withonevision/omnihive-hive-common/helpers/AwaitHelper";
import { IRestDrone } from "@withonevision/omnihive-hive-queen/interfaces/IRestDrone";
import { DroneBase } from "@withonevision/omnihive-hive-queen/models/DroneBase";
import { ITokenWorker } from "@withonevision/omnihive-hive-worker/interfaces/ITokenWorker";
import { HiveWorkerType } from "@withonevision/omnihive-hive-common/enums/HiveWorkerType";
import * as core from "express-serve-static-core";
import { QueenStore } from "../stores/QueenStore";
import { HiveWorkerFactory } from "@withonevision/omnihive-hive-worker/HiveWorkerFactory";
import swaggerUi from "swagger-ui-express";

export default class SystemCheckSettingsDrone extends DroneBase implements IRestDrone {

    public async register(app: core.Express, restRoot: string): Promise<void> {

        app.post(`${restRoot}/checkSettings`, async (req: core.Request, res: core.Response) => {

            try {
                await AwaitHelper.execute<void>(this.checkRequest(req));
                const accessToken: string | undefined = req.headers.ohAccess?.toString();

                const tokenWorker: ITokenWorker | undefined = await AwaitHelper.execute<ITokenWorker | undefined>(
                    HiveWorkerFactory.getInstance().getHiveWorker<ITokenWorker | undefined>(HiveWorkerType.Token));

                if (!accessToken || !tokenWorker) {
                    throw new Error("Request Denied");
                }

                const verified: boolean = await AwaitHelper.execute<boolean>(tokenWorker.verify(accessToken));
                return res.send(verified);
            } catch (e) {
                return res.status(400).send(e.message);
            }
        });
    }

    private checkRequest = async (req: core.Request) => {

        if (!req.headers) {
            throw new Error(`Request Denied`);
        }

        if (!req.headers.ohaccess) {
            throw new Error(`Request Denied`);
        }

        if (!req.body) {
            throw new Error(`Request Denied`);
        }

        if (!req.body.adminPassword || req.body.adminPassword === "") {
            throw new Error(`Request Denied`);
        }

        if (req.body.adminPassword !== QueenStore.getInstance().settings.server.adminPassword) {
            throw new Error(`Request Denied`);
        }

        if (!req.body.serverGroupName || req.body.serverGroupName === "") {
            throw new Error(`Request Denied`);
        }

        if (req.body.serverGroupName !== QueenStore.getInstance().settings.server.serverGroupName) {
            throw new Error(`Request Denied`);
        }
    }

    public getSwaggerDefinition = (): swaggerUi.JsonObject => {
        return {
            "definitions": {
                "CheckSettingsParameters": {
                    "required": [
                        "adminPassword",
                        "serverGroupName"
                    ],
                    "properties": {
                        "adminPassword": {
                            "type": "string"
                        },
                        "serverGroupName": {
                            "type": "string"
                        }
                    }
                }
            },
            "paths": {
                "/checkSettings": {
                    "post": {
                        "description": "Checks if your admin settings are correct",
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
                                        "$ref": "#/definitions/CheckSettingsParameters"
                                    }
                                }
                            }
                        },
                        "responses": {
                            "200": {
                                "description": "OmniHive Check Settings Response",
                                "content": {
                                    "text/plain": {
                                        "schema": {
                                            "type": "boolean"
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