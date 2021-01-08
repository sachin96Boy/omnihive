import { HiveWorkerType } from "@withonevision/omnihive-hive-common/enums/HiveWorkerType";
import { AwaitHelper } from "@withonevision/omnihive-hive-common/helpers/AwaitHelper";
import { HiveWorker } from "@withonevision/omnihive-hive-common/models/HiveWorker";
import { QueenStore } from "@withonevision/omnihive-hive-queen/stores/QueenStore";
import { HiveWorkerFactory } from "@withonevision/omnihive-hive-worker/HiveWorkerFactory";
import { IHiveWorker } from "@withonevision/omnihive-hive-worker/interfaces/IHiveWorker";
import { ITokenWorker } from "@withonevision/omnihive-hive-worker/interfaces/ITokenWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-hive-worker/models/HiveWorkerBase";
import { HiveWorkerMetadataRestFunction } from "@withonevision/omnihive-hive-worker/models/HiveWorkerMetadataRestFunction";
import * as core from "express-serve-static-core";
import swaggerUi from "swagger-ui-express";

export default class SystemCheckSettingsWorker extends HiveWorkerBase implements IHiveWorker {

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
                const accessToken: string | undefined = req.headers.ohAccess?.toString();
                const verified: boolean = await AwaitHelper.execute<boolean>(this.tokenWorker.verify(accessToken ?? ""));
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

    public getSwaggerDefinition = (): swaggerUi.JsonObject | undefined => {
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