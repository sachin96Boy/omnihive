import { Client } from "@elastic/elasticsearch";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { IHiveWorker } from "@withonevision/omnihive-core/interfaces/IHiveWorker";
import { HiveWorker } from "@withonevision/omnihive-core/models/HiveWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-core/models/HiveWorkerBase";
import { serializeError } from "serialize-error";

export type ElasticSearchFieldModel = {
    name: string;
    weight: number;
};

export class ElasticWorkerMetadata {
    public cloudId: string = "";
    public username: string = "";
    public password: string = "";
}

export default class ElasticWorker extends HiveWorkerBase {
    public worker?: IHiveWorker;
    public client?: Client;

    constructor() {
        super();
    }

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
        try {
            const indexExists = await this.validateIndex(index, true);

            if (this.client && indexExists) {
                return (
                    await this.client?.search({
                        index: index,
                        body: {
                            from: page * limit,
                            size: limit,
                            query: {
                                multi_match: {
                                    query: query,
                                    fuzziness: "auto",
                                    type: "most_fields",
                                    fields: fields?.map(
                                        (field: ElasticSearchFieldModel) => `${field.name}^${field.weight}`
                                    ),
                                },
                            },
                        },
                    })
                ).body;
            } else if (!indexExists) {
                throw new Error("Index does not exist");
            } else {
                throw new Error("Elastic Client not initialized");
            }
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    }

    public async create(index: string, idFieldName: string, data: any) {
        try {
            if (this.client) {
                const indexExists = await this.validateIndex(index);

                if (indexExists) {
                    await this.client?.index({
                        index: index,
                        id: data[idFieldName].toString(),
                        op_type: "create",
                        refresh: true,
                        body: data,
                    });
                }
            } else {
                throw new Error("Elastic Client not initialized");
            }
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    }

    public async update(index: string, id: string, data: any, upsert?: boolean) {
        try {
            if (this.client) {
                const indexExists = await this.validateIndex(index);

                if (indexExists) {
                    await this.client?.update({
                        index: index,
                        id: id,
                        body: {
                            doc: data,
                            doc_as_upsert: upsert,
                        },
                    });
                }
            } else {
                throw new Error("Elastic Client not initialized");
            }
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    }

    public async bulkUpdate(index: string, idObject: { name: string; values: string[] }, data: any) {
        try {
            const indexExists = await this.validateIndex(index, true);

            if (this.client && indexExists) {
                const updateQuery: { [key: string]: string[] } = {};
                updateQuery[idObject.name] = idObject.values;

                this.client?.updateByQuery({
                    index: index,
                    refresh: true,
                    body: {
                        doc: data,
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
            } else if (!indexExists) {
                return;
            } else {
                throw new Error("Elastic Client not initialized");
            }
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    }

    public async delete(index: string, id: string) {
        try {
            const indexExists = await this.validateIndex(index, true);

            if (this.client && indexExists) {
                await this.client?.delete({
                    index: index,
                    id: id,
                    refresh: true,
                });
            } else if (!indexExists) {
                return;
            } else {
                throw new Error("Elastic Client not initialized");
            }
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    }

    public async removeUnused(index: string, fieldName: string, usedKeys: string[]) {
        try {
            const indexExists = await this.validateIndex(index, true);

            if (this.client && indexExists) {
                const deleteObject: any = {};
                deleteObject[fieldName] = usedKeys;

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
            } else if (!indexExists) {
                return;
            } else {
                throw new Error("Elastic Client not initialized");
            }
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    }

    public async upsert(index: string, idName: string, idList: string[], data: any[]) {
        try {
            if (this.client) {
                await this.validateIndex(index);

                for (const id of idList) {
                    const idData: any = data.find((x: any) => x[idName].toString() === id);

                    await AwaitHelper.execute(this.update(index, id, idData, true));
                }
                return;
            } else {
                throw new Error("Elastic Client not initialized");
            }
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    }

    public async validateIndex(index: string, noCreate: boolean = false) {
        try {
            if (this.client) {
                const indexExists: boolean = (await this.client.indices.exists({ index: index })).body;

                if (!indexExists && !noCreate) {
                    await this.client?.indices.create({ index: index });
                    return true;
                }

                return indexExists;
            } else {
                throw new Error("Elastic Client not initialized");
            }
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    }

    public async deleteIndex(index: string) {
        try {
            const indexExists = await this.validateIndex(index, true);

            if (this.client && indexExists) {
                this.client.indices.delete({ index: index });
            } else if (!indexExists) {
                return;
            } else {
                throw new Error("Elastic Client not initialized");
            }
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    }

    public async fixDateMappings(index: string, data: any) {
        try {
            if (this.client) {
                const dateMappings: { [key: string]: { type: string; format: string } } = {};

                for (const key in data) {
                    const mappings = await this.client.indices.getMapping({ index: index });

                    if (
                        data[key] &&
                        typeof data[key] === "string" &&
                        data[key].search(/\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)/g) >=
                            0 &&
                        mappings.body[index].mappings.properties[key].format !== "yyyy-MM-dd'T'HH:mm:ss.SSSz"
                    ) {
                        dateMappings[key] = {
                            type: "date",
                            format: "yyyy-MM-dd'T'HH:mm:ss.SSSz",
                        };
                    }
                }

                if (Object.keys(dateMappings).length > 0) {
                    await this.client.indices.putMapping({
                        index: index,
                        body: {
                            properties: dateMappings,
                        },
                    });
                }
            } else {
                throw new Error("Elastic Client not initialized");
            }
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    }
}
