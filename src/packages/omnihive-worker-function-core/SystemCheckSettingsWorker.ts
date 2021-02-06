import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { CoreServiceFactory } from "@withonevision/omnihive-core/factories/CoreServiceFactory";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { IRestEndpointWorker } from "@withonevision/omnihive-core/interfaces/IRestEndpointWorker";
import { ITokenWorker } from "@withonevision/omnihive-core/interfaces/ITokenWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-core/models/HiveWorkerBase";
import { serializeError } from "serialize-error";
import swaggerUi from "swagger-ui-express";

class SystemCheckSettingsRequest {
    adminPassword!: string;
    serverGroupName!: string;
}

export default class SystemCheckSettingsWorker extends HiveWorkerBase implements IRestEndpointWorker {
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
            return [{ verified: verified }, 200];
        } catch (e) {
            return [{ error: serializeError(e) }, 400];
        }
    };

    public getSwaggerDefinition = (): swaggerUi.JsonObject | undefined => {
        return {
            definitions: {
                CheckSettingsParameters: {
                    required: ["adminPassword", "serverGroupName"],
                    properties: {
                        adminPassword: {
                            type: "string",
                        },
                        serverGroupName: {
                            type: "string",
                        },
                    },
                },
            },
            paths: {
                "/checkSettings": {
                    post: {
                        description: "Checks if your admin settings are correct",
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
                                        $ref: "#/definitions/CheckSettingsParameters",
                                    },
                                },
                            },
                        },
                        responses: {
                            "200": {
                                description: "OmniHive Check Settings Response",
                                content: {
                                    "text/plain": {
                                        schema: {
                                            type: "boolean",
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

    private checkRequest = (headers: any, body: any | undefined) => {
        if (!headers || !body) {
            throw new Error("Request Denied");
        }

        const paramsStructured: SystemCheckSettingsRequest = this.checkObjectStructure<SystemCheckSettingsRequest>(
            SystemCheckSettingsRequest,
            body
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

        if (!paramsStructured.serverGroupName || paramsStructured.serverGroupName === "") {
            throw new Error(`Request Denied`);
        }

        if (
            paramsStructured.serverGroupName !== CoreServiceFactory.configurationService.settings.config.serverGroupName
        ) {
            throw new Error(`Request Denied`);
        }
    };
}
