import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { RestMethod } from "@withonevision/omnihive-core/enums/RestMethod";
import { StringBuilder } from "@withonevision/omnihive-core/helpers/StringBuilder";
import { IDatabaseWorker } from "@withonevision/omnihive-core/interfaces/IDatabaseWorker";
import { IEncryptionWorker } from "@withonevision/omnihive-core/interfaces/IEncryptionWorker";
import { HiveWorkerMetadataDatabase } from "@withonevision/omnihive-core/models/HiveWorkerMetadataDatabase";
import { ServerSettings } from "@withonevision/omnihive-core/models/ServerSettings";
import { CommonStore } from "@withonevision/omnihive-core/stores/CommonStore";
import axios, { AxiosResponse, AxiosRequestConfig } from "axios";

export class OmniHiveClient {
    private static instance: OmniHiveClient;

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    private constructor() {}

    public static getInstance = (): OmniHiveClient => {
        if (!OmniHiveClient.instance) {
            OmniHiveClient.instance = new OmniHiveClient();
        }

        return OmniHiveClient.instance;
    };

    public static getNew = (): OmniHiveClient => {
        return new OmniHiveClient();
    };

    public init = async (settings: ServerSettings): Promise<void> => {
        await CommonStore.getInstance().initWorkers(settings.workers);
    }

    public restClient = async (url: string, method: RestMethod, headers?: any, data?: any): Promise<any> => {
        return new Promise<AxiosResponse<any>>((resolve, reject) => {
            const axiosConfig: AxiosRequestConfig = { url: url };

            if (headers == null) {
                headers = {};
            }

            if (Object.keys(headers).length > 0) {
                axiosConfig.headers = headers;
            }

            if (data != null) {
                axiosConfig.data = data;
            }

            switch (method) {
                case RestMethod.GET:
                    axiosConfig.method = "GET";
                    break;
                case RestMethod.POST:
                    axiosConfig.method = "POST";
                    break;
                case RestMethod.PATCH:
                    axiosConfig.method = "PATCH";
                    break;
                case RestMethod.PUT:
                    axiosConfig.method = "PUT";
                    break;
                case RestMethod.DELETE:
                    axiosConfig.method = "DELETE";
                    break;
            }

            axios(axiosConfig)
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

    public graphClient = async (graphUrl: string, query: string): Promise<any> => {
        const graphCall: Promise<any> = new Promise<any>((resolve, reject) => {
            const config: any = {};
            config.headers = {};
            config.headers["Content-Type"] = "application/json";
            let dataObject: any = { query };

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

    public runCustomSql = async (url: string, sql: string, dbWorkerName: string, encryptionWorkerName?: string): Promise<any> => {

        let encryptionWorker: IEncryptionWorker | undefined = undefined;

        if (encryptionWorkerName) {
            encryptionWorker = await CommonStore.getInstance().getHiveWorker<IEncryptionWorker | undefined>(HiveWorkerType.Encryption, encryptionWorkerName);
        } else {
            encryptionWorker = await CommonStore.getInstance().getHiveWorker<IEncryptionWorker | undefined>(HiveWorkerType.Encryption);
        }

        if (!encryptionWorker) {
            throw new Error("No encryption worker found.  An encryption worker is required for custom SQL");
        }

        const dbWorker: IDatabaseWorker | undefined = await CommonStore.getInstance().getHiveWorker<IDatabaseWorker | undefined>(HiveWorkerType.Database, dbWorkerName);

        if (!dbWorker) {
            throw new Error("No database worker with the given name found.");
        }

        const dbMeta: HiveWorkerMetadataDatabase = dbWorker.config.metadata as HiveWorkerMetadataDatabase;

        let target: string = `${dbMeta.generatorPrefix}customSql`;
        let secureSql: string = encryptionWorker.symmetricEncrypt(sql);

        let query: string = `
            query {
                ${target}(
                    encryptedSql: "${secureSql}"
                ) {
                    recordset
                }
            }
        `;

        let results: any = await this.graphClient(url, query);
        return results[target][0].recordset;
    };
}
