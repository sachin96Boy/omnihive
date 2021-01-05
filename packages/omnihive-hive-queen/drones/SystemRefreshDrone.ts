import { AwaitHelper } from "@withonevision/omnihive-hive-common/helpers/AwaitHelper";
import { OmniHiveConstants } from "@withonevision/omnihive-hive-common/models/OmniHiveConstants";
import { IRestDrone } from "@withonevision/omnihive-hive-queen/interfaces/IRestDrone";
import { DroneBase } from "@withonevision/omnihive-hive-queen/models/DroneBase";
import { IPubSubServerWorker } from "@withonevision/omnihive-hive-worker/interfaces/IPubSubServerWorker";
import { HiveWorkerType } from "@withonevision/omnihive-hive-common/enums/HiveWorkerType";
import * as core from "express-serve-static-core";
import { QueenStore } from "../stores/QueenStore";
import { HiveWorkerFactory } from "@withonevision/omnihive-hive-worker/HiveWorkerFactory";
import swaggerUi from "swagger-ui-express";
import { ITokenWorker } from "@withonevision/omnihive-hive-worker/interfaces/ITokenWorker";

export default class SystemRefreshDrone extends DroneBase implements IRestDrone {

    public async register(app: core.Express, restRoot: string): Promise<void> {

        app.post(`${restRoot}/refresh`, async (req, res) => {
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

                const adminPubSubServer: IPubSubServerWorker | undefined = await AwaitHelper.execute<IPubSubServerWorker | undefined>(
                    HiveWorkerFactory.getInstance().getHiveWorker<IPubSubServerWorker>(HiveWorkerType.PubSubServer, OmniHiveConstants.ADMIN_PUBSUB_SERVER_WORKER_INSTANCE));

                if (!adminPubSubServer) {
                    throw new Error("No admin pub-sub server hive worker found");
                }

                adminPubSubServer.emit(QueenStore.getInstance().settings.server.serverGroupName, "server-reset-request", { reset: true });

                return res.send("Server Refresh/Reset Initiated");
            }
            catch (e) {
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
                "ServerResetParameters": {
                    "required": [
                        "adminPassword"
                    ],
                    "properties": {
                        "adminPassword": {
                            "type": "string"
                        }
                    }
                }
            },
            "paths": {
                "/refresh": {
                    "post": {
                        "description": "Resets your OmniHive Server",
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
                                        "$ref": "#/definitions/ServerResetParameters"
                                    }
                                }
                            }
                        },
                        "responses": {
                            "200": {
                                "description": "OmniHive Server Reset Response",
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
