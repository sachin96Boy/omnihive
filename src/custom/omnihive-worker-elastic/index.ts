import { Client } from "@elastic/elasticsearch";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { IHiveWorker } from "@withonevision/omnihive-core/interfaces/IHiveWorker";
import { HiveWorker } from "@withonevision/omnihive-core/models/HiveWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-core/models/HiveWorkerBase";
import { serializeError } from "serialize-error";

type ElasticSearchFieldModel = {
    name: string;
    weight: number;
};

type ElasticFieldModel = {
    name: string;
    value: any;
};

export class ElasticWorkerMetadata {
    public cloudId: string = "";
    public username: string = "";
    public password: string = "";
}

export default class ElasticWorker extends HiveWorkerBase {
    public worker?: IHiveWorker;
    public client?: Client;

    public async init(config: HiveWorker) {
        try {
            await AwaitHelper.execute<void>(super.init(config));

            const metadata = this.checkObjectStructure<ElasticWorkerMetadata>(ElasticWorkerMetadata, config.metadata);

            this.client = new Client({
                cloud: {
                    id: metadata.cloudId,
                },
                auth: {
                    username: metadata.username,
                    password: metadata.password,
                },
            });
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    }

    public async search(
        index: string,
        query: string,
        fields?: ElasticSearchFieldModel[],
        page: number = 0,
        limit: number = 100
    ) {
        return await this.client?.search({
            index: index,
            body: {
                from: page * limit,
                size: limit,
                query: {
                    multi_match: {
                        query: query,
                        fuzziness: "auto",
                        type: "most_fields",
                        fields: fields?.map((field: ElasticSearchFieldModel) => `${field.name}^${field.weight}`),
                    },
                },
            },
        });
    }

    public async create(index: string, idFieldName: string, data: ElasticFieldModel[]) {
        try {
            const insertObject: { [key: string]: string } = {};
            data.forEach((item: ElasticFieldModel) => {
                insertObject[item.name] = item.value;
            });

            await this.client?.index({
                index: index,
                id: insertObject[idFieldName],
                op_type: "create",
                refresh: true,
                body: insertObject,
            });
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    }

    public async update(index: string, id: string, data: ElasticFieldModel[]) {
        try {
            await this.client?.update({
                index: index,
                id: id,
                body: data,
            });
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    }

    public async bulkUpdate(index: string, idObject: { name: string; values: string[] }, data: ElasticFieldModel[]) {
        try {
            let updateObject: string = "";
            data.forEach((item: ElasticFieldModel) => {
                if (updateObject.length > 0) {
                    updateObject += `;`;
                }
                updateObject += `ctx._source['${item.name}'] = '${item.value}'`;
            });

            const updateQuery: { [key: string]: string[] } = {};
            updateQuery[idObject.name] = idObject.values;

            this.client?.updateByQuery({
                index: index,
                refresh: true,
                body: {
                    script: {
                        lang: "painless",
                        source: updateObject,
                    },
                    query: {
                        bool: {
                            must: [
                                {
                                    terms: { updateQuery },
                                },
                            ],
                        },
                    },
                },
            });
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    }

    public async delete(index: string, id: string) {
        try {
            await this.client?.delete({
                index: index,
                id: id,
                refresh: true,
            });
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    }

    public async bulkDelete(index: string, fieldName: string, removeKeys: string[]) {
        try {
            const deleteObject: any = {};
            deleteObject[fieldName] = removeKeys;

            await this.client?.deleteByQuery({
                index: index,
                body: {
                    query: {
                        bool: {
                            must_not: [
                                {
                                    terms: deleteObject,
                                },
                            ],
                        },
                    },
                },
            });
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    }
}
