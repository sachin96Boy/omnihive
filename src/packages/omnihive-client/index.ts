import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { RestMethod } from "@withonevision/omnihive-core/enums/RestMethod";
import { CoreServiceFactory } from "@withonevision/omnihive-core/factories/CoreServiceFactory";
import { StringBuilder } from "@withonevision/omnihive-core/helpers/StringBuilder";
import { IDatabaseWorker } from "@withonevision/omnihive-core/interfaces/IDatabaseWorker";
import { IEncryptionWorker } from "@withonevision/omnihive-core/interfaces/IEncryptionWorker";
import { HiveWorkerMetadataDatabase } from "@withonevision/omnihive-core/models/HiveWorkerMetadataDatabase";
import { ServerSettings } from "@withonevision/omnihive-core/models/ServerSettings";
import axios, { AxiosResponse, AxiosRequestConfig } from "axios";

export class OmniHiveClient {
    private static singleton: OmniHiveClient;

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    private constructor() {}

    public static getSingleton = (): OmniHiveClient => {
        if (!OmniHiveClient.singleton) {
            OmniHiveClient.singleton = new OmniHiveClient();
        }

        return OmniHiveClient.singleton;
    };

    public static getNew = (): OmniHiveClient => {
        return new OmniHiveClient();
    };

    public init = async (settings: ServerSettings): Promise<void> => {
        await CoreServiceFactory.workerService.initWorkers(settings.workers);
    };

    public restClient = async (url: string, method: RestMethod, headers?: any, data?: any): Promise<any> => {
        return new Promise<AxiosResponse<any>>((resolve, reject) => {
            const config: AxiosRequestConfig = { url: url };

            if (headers == null) {
                headers = {};
            }

            if (Object.keys(headers).length > 0) {
                config.headers = headers;
            }

            if (data != null) {
                config.data = data;
            }

            switch (method) {
                case RestMethod.GET:
                    config.method = "GET";
                    break;
                case RestMethod.POST:
                    config.method = "POST";
                    break;
                case RestMethod.PATCH:
                    config.method = "PATCH";
                    break;
                case RestMethod.PUT:
                    config.method = "PUT";
                    break;
                case RestMethod.DELETE:
                    config.method = "DELETE";
                    break;
            }

            axios(config)
                .then((response: AxiosResponse) => {
                    if (response.data.errors != null && response.data.errors.length > 0) {
                        const errorString: StringBuilder = new StringBuilder();

                        response.data.errors.forEach((err: any) => {
                            errorString.appendLine(err.message);
                        });

                        throw new Error(errorString.outputString());
                    }

                    resolve(response.data);
                })
                .catch((reason: any) => {
                    reject(reason);
                });
        });
    };

    public graphClient = async (graphUrl: string, query: string, headers?: any): Promise<any> => {
        const graphCall: Promise<any> = new Promise<any>((resolve, reject) => {
            const config: any = {};

            if (headers == null) {
                config.headers = {};
            }

            if (Object.keys(headers).length > 0) {
                config.headers = headers;
            }

            config.headers["Content-Type"] = "application/json";
            const dataObject: any = { query };

            axios
                .post(graphUrl, JSON.stringify(dataObject), config as Object)
                .then((response) => {
                    if (response.data.errors != null && response.data.errors.length > 0) {
                        const errorString: StringBuilder = new StringBuilder();

                        response.data.errors.forEach((err: any) => {
                            errorString.appendLine(err.message);
                        });

                        throw new Error(errorString.outputString());
                    }

                    resolve(response.data.data);
                })
                .catch((error) => {
                    reject(error);
                });
        });

        return graphCall;
    };

    public runCustomSql = async (
        url: string,
        sql: string,
        dbWorkerName: string,
        encryptionWorkerName?: string
    ): Promise<any> => {
        let encryptionWorker: IEncryptionWorker | undefined = undefined;

        if (encryptionWorkerName) {
            encryptionWorker = await CoreServiceFactory.workerService.getWorker<IEncryptionWorker | undefined>(
                HiveWorkerType.Encryption,
                encryptionWorkerName
            );
        } else {
            encryptionWorker = await CoreServiceFactory.workerService.getWorker<IEncryptionWorker | undefined>(
                HiveWorkerType.Encryption
            );
        }

        if (!encryptionWorker) {
            throw new Error("No encryption worker found.  An encryption worker is required for custom SQL");
        }

        const dbWorker: IDatabaseWorker | undefined = await CoreServiceFactory.workerService.getWorker<
            IDatabaseWorker | undefined
        >(HiveWorkerType.Database, dbWorkerName);

        if (!dbWorker) {
            throw new Error("No database worker with the given name found.");
        }

        const target: string = `customSql`;
        const secureSql: string = encryptionWorker.symmetricEncrypt(sql);

        const query: string = `
            query {
                ${target}(
                    encryptedSql: "${secureSql}"
                ) {
                    recordset
                }
            }
        `;

        const results: any = await this.graphClient(url, query);
        return results[target][0].recordset;
    };
}
