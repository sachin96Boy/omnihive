import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { CoreServiceFactory } from "@withonevision/omnihive-core/factories/CoreServiceFactory";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { IPubSubServerWorker } from "@withonevision/omnihive-core/interfaces/IPubSubServerWorker";
import { IRestEndpointWorker } from "@withonevision/omnihive-core/interfaces/IRestEndpointWorker";
import { ITokenWorker } from "@withonevision/omnihive-core/interfaces/ITokenWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-core/models/HiveWorkerBase";
import { serializeError } from "serialize-error";
import swaggerUi from "swagger-ui-express";

class SystemRefreshRequest {
    adminPassword!: string;
}

export default class SystemRefreshWorker extends HiveWorkerBase implements IRestEndpointWorker {
    private tokenWorker!: ITokenWorker;

    constructor() {
        super();
    }

    public execute = async (headers: any, _url: string, body: any): Promise<[{} | undefined, number]> => {
        const tokenWorker: ITokenWorker | undefined = await AwaitHelper.execute<ITokenWorker | undefined>(
            CoreServiceFactory.workerService.getWorker<ITokenWorker>(HiveWorkerType.Token)
        );

        if (!tokenWorker) {
            throw new Error("Token Worker cannot be found");
        }

        this.tokenWorker = tokenWorker;

        try {
            this.checkRequest(headers, body);
            const accessToken: string | undefined = headers.ohAccess?.toString();
            const verified: boolean = await AwaitHelper.execute<boolean>(this.tokenWorker.verify(accessToken ?? ""));

            if (!verified) {
                throw new Error("Invalid Access Token");
            }

            const adminPubSubServerWorkerName: string | undefined =
                CoreServiceFactory.configurationService.settings.constants["adminPubSubServerWorkerInstance"];

            const adminPubSubServer: IPubSubServerWorker | undefined = await AwaitHelper.execute<
                IPubSubServerWorker | undefined
            >(
                CoreServiceFactory.workerService.getWorker<IPubSubServerWorker>(
                    HiveWorkerType.PubSubServer,
                    adminPubSubServerWorkerName
                )
            );

            if (!adminPubSubServer) {
                throw new Error("No admin pub-sub server hive worker found");
            }

            adminPubSubServer.emit(
                CoreServiceFactory.configurationService.settings.config.serverGroupName,
                "server-reset-request",
                {
                    reset: true,
                }
            );

            return [{ message: "Server Refresh/Reset Initiated" }, 200];
        } catch (e) {
            return [{ error: serializeError(e) }, 400];
        }
    };

    public getSwaggerDefinition = (): swaggerUi.JsonObject => {
        return {
            definitions: {
                ServerResetParameters: {
                    required: ["adminPassword"],
                    properties: {
                        adminPassword: {
                            type: "string",
                        },
                    },
                },
            },
            paths: {
                "/refresh": {
                    post: {
                        description: "Resets your OmniHive Server",
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
                                        $ref: "#/definitions/ServerResetParameters",
                                    },
                                },
                            },
                        },
                        responses: {
                            "200": {
                                description: "OmniHive Server Reset Response",
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

    private checkRequest = (headers: any, params: any | undefined) => {
        if (!headers || !params) {
            throw new Error("Request Denied");
        }

        const paramsStructured: SystemRefreshRequest = this.checkObjectStructure<SystemRefreshRequest>(
            SystemRefreshRequest,
            params
        );

        if (!headers.ohaccess) {
            throw new Error(`Request Denied`);
        }

        if (!paramsStructured.adminPassword || paramsStructured.adminPassword === "") {
            throw new Error(`Request Denied`);
        }

        if (paramsStructured.adminPassword !== CoreServiceFactory.configurationService.settings.config.adminPassword) {
            throw new Error(`Request Denied`);
        }
    };
}
