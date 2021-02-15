import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { RestMethod } from "@withonevision/omnihive-core/enums/RestMethod";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { StringBuilder } from "@withonevision/omnihive-core/helpers/StringBuilder";
import { IEncryptionWorker } from "@withonevision/omnihive-core/interfaces/IEncryptionWorker";
import { IHiveWorker } from "@withonevision/omnihive-core/interfaces/IHiveWorker";
import { HiveWorker } from "@withonevision/omnihive-core/models/HiveWorker";
import { RegisteredHiveWorker } from "@withonevision/omnihive-core/models/RegisteredHiveWorker";
import { ServerSettings } from "@withonevision/omnihive-core/models/ServerSettings";
import axios, { AxiosResponse, AxiosRequestConfig } from "axios";
import { serializeError } from "serialize-error";

export class OmniHiveClient {
    private static singleton: OmniHiveClient;
    public registeredWorkers: RegisteredHiveWorker[] = [];
    public settings: ServerSettings = new ServerSettings();

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
        this.settings = settings;
        try {
            for (const hiveWorker of settings.workers) {
                await this.pushWorker(hiveWorker, false);
            }

            for (const worker of this.registeredWorkers ?? []) {
                await AwaitHelper.execute<void>(
                    (worker.instance as IHiveWorker).afterInit(this.registeredWorkers, this.settings)
                );
            }
        } catch (err) {
            throw new Error("Worker Factory Init Error => " + JSON.stringify(serializeError(err)));
        }
    };

    public clearWorkers = (): void => {
        this.registeredWorkers = [];
    };

    public getAllWorkers = (): RegisteredHiveWorker[] => {
        return this.registeredWorkers ?? [];
    };

    public getWorker = <T extends IHiveWorker | undefined>(type: string, name?: string): T | undefined => {
        if (name) {
            const namedWorker: RegisteredHiveWorker | undefined = this.registeredWorkers.find(
                (value: RegisteredHiveWorker) => value.name === name && value.type === type && value.enabled === true
            );

            if (namedWorker) {
                return namedWorker.instance as T;
            }

            return undefined;
        }

        const defaultWorker: RegisteredHiveWorker | undefined = this.registeredWorkers.find(
            (value: RegisteredHiveWorker) => value.type === type && value.enabled === true && value.default === true
        );

        if (defaultWorker) {
            return defaultWorker.instance as T;
        }

        const anyWorkers: RegisteredHiveWorker[] | undefined = this.registeredWorkers.filter(
            (value: RegisteredHiveWorker) => value.type === type && value.enabled === true
        );

        if (anyWorkers && anyWorkers.length > 0) {
            return anyWorkers[0].instance as T;
        }

        return undefined;
    };

    public getWorkersByType = (type: string): RegisteredHiveWorker[] => {
        return (
            this.registeredWorkers?.filter((rw: RegisteredHiveWorker) => rw.type === type && rw.enabled === true) ?? []
        );
    };

    public pushWorker = async (hiveWorker: HiveWorker, runAfterInit: boolean = true): Promise<void> => {
        if (!hiveWorker.enabled) {
            return;
        }

        if (
            this.registeredWorkers?.find((value: RegisteredHiveWorker) => {
                return value.name === hiveWorker.name;
            })
        ) {
            return;
        }

        if (
            !hiveWorker.importPath ||
            hiveWorker.importPath === "" ||
            !hiveWorker.package ||
            hiveWorker.package === ""
        ) {
            throw new Error(`Hive worker type ${hiveWorker.type} with name ${hiveWorker.name} has no import path`);
        }

        const newWorker: any = await AwaitHelper.execute<any>(import(hiveWorker.importPath));
        const newWorkerInstance: any = new newWorker.default();
        await AwaitHelper.execute<void>((newWorkerInstance as IHiveWorker).init(hiveWorker));

        if (runAfterInit) {
            await AwaitHelper.execute<void>(
                (newWorkerInstance as IHiveWorker).afterInit(this.registeredWorkers, this.settings)
            );
        }

        const registeredWorker: RegisteredHiveWorker = { ...hiveWorker, instance: newWorkerInstance };
        let globalWorkers: RegisteredHiveWorker[] | undefined = this.registeredWorkers;

        if (!globalWorkers) {
            globalWorkers = [];
        }

        globalWorkers.push(registeredWorker);
        this.registeredWorkers = globalWorkers;
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
            encryptionWorker = await this.getWorker<IEncryptionWorker | undefined>(
                HiveWorkerType.Encryption,
                encryptionWorkerName
            );
        } else {
            encryptionWorker = await this.getWorker<IEncryptionWorker | undefined>(HiveWorkerType.Encryption);
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
