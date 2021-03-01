import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { RestMethod } from "@withonevision/omnihive-core/enums/RestMethod";
import { StringBuilder } from "@withonevision/omnihive-core/helpers/StringBuilder";
import { IEncryptionWorker } from "@withonevision/omnihive-core/interfaces/IEncryptionWorker";
import { ServerSettings } from "@withonevision/omnihive-core/models/ServerSettings";
import { WorkerSetterBase } from "@withonevision/omnihive-core/models/WorkerSetterBase";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";

export class OmniHiveClient extends WorkerSetterBase {
    private static singleton: OmniHiveClient;

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    private constructor() {
        super();
    }

    public static getSingleton = (): OmniHiveClient => {
        if (!OmniHiveClient.singleton) {
            OmniHiveClient.singleton = new OmniHiveClient();
        }

        return OmniHiveClient.singleton;
    };

    public static getNew = (): OmniHiveClient => {
        return new OmniHiveClient();
    };

    public init = async (serverSettings: ServerSettings): Promise<void> => {
        this.serverSettings = serverSettings;
        this.initWorkers(serverSettings.workers);
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

            if (!headers) {
                config.headers = {};
            } else if (Object.keys(headers).length > 0) {
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

    public runCustomSql = async (url: string, sql: string, encryptionWorkerName?: string): Promise<any> => {
        let encryptionWorker: IEncryptionWorker | undefined = undefined;

        if (encryptionWorkerName) {
            encryptionWorker = this.getWorker<IEncryptionWorker | undefined>(
                HiveWorkerType.Encryption,
                encryptionWorkerName
            );
        } else {
            encryptionWorker = this.getWorker<IEncryptionWorker | undefined>(HiveWorkerType.Encryption);
        }

        if (!encryptionWorker) {
            throw new Error("No encryption worker found.  An encryption worker is required for custom SQL");
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
