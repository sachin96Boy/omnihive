import { HiveWorkerType } from "@withonevision/omnihive-common/enums/HiveWorkerType";
import { AwaitHelper } from "@withonevision/omnihive-common/helpers/AwaitHelper";
import { IHiveWorker } from "@withonevision/omnihive-common/interfaces/IHiveWorker";
import { ITokenWorker } from "@withonevision/omnihive-common/interfaces/ITokenWorker";
import { HiveWorker } from "@withonevision/omnihive-common/models/HiveWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-common/models/HiveWorkerBase";
import { HiveWorkerMetadataRestFunction } from "@withonevision/omnihive-common/models/HiveWorkerMetadataRestFunction";
import { CommonStore } from "@withonevision/omnihive-common/stores/CommonStore";
import express from "express";
import swaggerUi from "swagger-ui-express";

export default class SystemStatusWorker extends HiveWorkerBase implements IHiveWorker {
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
                const accessToken: string | undefined = req.headers.ohAccess?.toString();
                const verified: boolean = await AwaitHelper.execute<boolean>(
                    this.tokenWorker.verify(accessToken ?? "")
                );

                if (!verified) {
                    throw new Error("Invalid Access Token");
                }

                res.setHeader("Content-Type", "application/json");
                return res.status(200).json(CommonStore.getInstance().status);
            } catch (e) {
                return res.status(400).send(e.message);
            }
        });
    }

    private checkRequest = async (req: express.Request) => {
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
    };

    public getSwaggerDefinition = (): swaggerUi.JsonObject => {
        return {
            definitions: {
                GetStatusParameters: {
                    required: ["adminPassword"],
                    properties: {
                        adminPassword: {
                            type: "string",
                        },
                    },
                },
                GetStatusReturn: {
                    properties: {
                        serverStatus: {
                            type: "string",
                        },
                        serverError: {
                            type: "string",
                        },
                    },
                },
            },
            paths: {
                "/status": {
                    post: {
                        description: "Gets the OmniHive server status",
                        tags: [
                            {
                                name: "System",
                            },
                        ],
                        parameters: [
                            {
                                in: "header",
                                name: "ohaccess",
                                required: true,
                                schema: {
                                    type: "string",
                                },
                            },
                        ],
                        requestBody: {
                            required: true,
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/definitions/GetStatusParameters",
                                    },
                                },
                            },
                        },
                        responses: {
                            "200": {
                                description: "OmniHive Check Settings Response",
                                content: {
                                    "application/json": {
                                        schema: {
                                            $ref: "#/definitions/GetStatusReturn",
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
