
import { HiveWorkerType } from "@withonevision/omnihive-common/enums/HiveWorkerType";
import { AwaitHelper } from "@withonevision/omnihive-common/helpers/AwaitHelper";
import { IHiveWorker } from "@withonevision/omnihive-common/interfaces/IHiveWorker";
import { IPubSubServerWorker } from "@withonevision/omnihive-common/interfaces/IPubSubServerWorker";
import { ITokenWorker } from "@withonevision/omnihive-common/interfaces/ITokenWorker";
import { HiveWorker } from "@withonevision/omnihive-common/models/HiveWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-common/models/HiveWorkerBase";
import { HiveWorkerMetadataRestFunction } from "@withonevision/omnihive-common/models/HiveWorkerMetadataRestFunction";
import { CommonStore } from "@withonevision/omnihive-common/stores/CommonStore";
import * as core from "express-serve-static-core";
import swaggerUi from "swagger-ui-express";

export default class SystemRefreshWorker extends HiveWorkerBase implements IHiveWorker {

    private tokenWorker!: ITokenWorker;
    private metadata!: HiveWorkerMetadataRestFunction;

    constructor() {
        super();
    }

    public async init(config: HiveWorker): Promise<void> {
        await AwaitHelper.execute<void>(super.init(config));
        this.metadata = this.checkMetadata<HiveWorkerMetadataRestFunction>(HiveWorkerMetadataRestFunction, config.metadata);
    }

    public async register(app: core.Express, restRoot: string): Promise<void> {

        const tokenWorker: ITokenWorker | undefined = await AwaitHelper.execute<ITokenWorker | undefined>(
            CommonStore.getInstance().getHiveWorker<ITokenWorker>(HiveWorkerType.Token));

        if (!tokenWorker) {
            throw new Error("Token Worker cannot be found");
        }

        this.tokenWorker = tokenWorker;

        app.post(`${restRoot}${this.metadata.methodUrl}`, async (req: core.Request, res: core.Response) => {
            try {
                await AwaitHelper.execute<void>(this.checkRequest(req));
                const accessToken: string | undefined = req.headers.ohAccess?.toString()
                const verified: boolean = await AwaitHelper.execute<boolean>(this.tokenWorker.verify(accessToken ?? ""));

                if (!verified) {
                    throw new Error("Invalid Access Token");
                }

                const adminPubSubServerWorkerName: string | undefined = CommonStore.getInstance().settings.constants["adminPubSubServerWorkerInstance"];

                const adminPubSubServer: IPubSubServerWorker | undefined = await AwaitHelper.execute<IPubSubServerWorker | undefined>(
                    CommonStore.getInstance().getHiveWorker<IPubSubServerWorker>(HiveWorkerType.PubSubServer, adminPubSubServerWorkerName));

                if (!adminPubSubServer) {
                    throw new Error("No admin pub-sub server hive worker found");
                }

                adminPubSubServer.emit(CommonStore.getInstance().settings.config.serverGroupName, "server-reset-request", { reset: true });

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

        if (req.body.adminPassword !== CommonStore.getInstance().settings.config.adminPassword) {
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
