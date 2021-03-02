import { OmniHiveClient } from "@withonevision/omnihive-client";
import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { CoreServiceFactory } from "@withonevision/omnihive-core/factories/CoreServiceFactory";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { ITaskEndpointWorker } from "@withonevision/omnihive-core/interfaces/ITaskEndpointWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-core/models/HiveWorkerBase";
import chalk from "chalk";
import dayjs from "dayjs";
import { serializeError } from "serialize-error";
import ElasticWorker from "src/custom/omnihive-worker-elastic";

export default class CmsSearchImporter extends HiveWorkerBase implements ITaskEndpointWorker {
    private graphUrl = "";

    public execute = async (): Promise<any> => {
        try {
            const idList: string[] = [];

            const elasticWorker = (await CoreServiceFactory.workerService.getWorker(
                HiveWorkerType.Unknown,
                "ohElastic"
            )) as ElasticWorker;

            elasticWorker.init(elasticWorker.config);

            this.graphUrl = this.config.metadata.mpGraphUrl;

            const documentDataIds: { typeIds: number[]; siteIds: number[] } = await AwaitHelper.execute<{
                typeIds: number[];
                siteIds: number[];
            }>(this.getDocumentTypeIds());

            for (const siteId of documentDataIds.siteIds) {
                for (const typeId of documentDataIds.typeIds) {
                    console.log(
                        chalk.yellow(
                            `(${dayjs().format(
                                "YYYY-MM-DD HH:mm:ss"
                            )}) => Started processing siteId: ${siteId} and typeId: ${typeId}`
                        )
                    );

                    const docList = await AwaitHelper.execute<any>(this.getFullDocuments(siteId, typeId));

                    if (docList && docList.length > 0) {
                        docList.forEach((x: any) => {
                            idList.push(x.SiteDocumentId.toString());
                        });

                        if (docList && docList.length > 0) {
                            const chunk = 50;
                            for (let i = 0; i < docList.length; i += chunk) {
                                const docChunk = docList.slice(i, i + chunk);

                                const elasticIdList: string[] = [];
                                docChunk.forEach((x: any) => {
                                    for (const key in x) {
                                        if (
                                            !x[key] ||
                                            key.includes("Video Attribute") ||
                                            key.includes("Metadata") ||
                                            key.includes("Resources")
                                        ) {
                                            delete x[key];
                                            continue;
                                        }

                                        if (typeof x[key] === "number") {
                                            continue;
                                        }

                                        if (typeof x[key] === "string") {
                                            x[key] = x[key].replace(/<[^>]*>/g, "").replace(/"/g, '\\"');
                                            continue;
                                        }

                                        if (dayjs(x[key]).isValid()) {
                                            x[key] = dayjs(x[key]).format("YYYY-MM-DDThh:mm:ss");
                                            continue;
                                        }
                                    }
                                    elasticIdList.push(x.SiteDocumentId.toString());
                                });

                                await AwaitHelper.execute(
                                    elasticWorker.upsert("cms", "SiteDocumentId", elasticIdList, docChunk)
                                );
                            }
                        }
                    }

                    console.log(
                        chalk.greenBright(
                            `(${dayjs().format(
                                "YYYY-MM-DD HH:mm:ss"
                            )}) => Completed processing siteId: ${siteId} and typeId: ${typeId}`
                        )
                    );
                }
            }

            if (idList.length > 0) {
                await AwaitHelper.execute(elasticWorker.removeUnused("cms", "SiteDocumentId", idList));
            }

            return;
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    };

    private getDocumentTypeIds = async (): Promise<{ typeIds: number[]; siteIds: number[] }> => {
        const query = `
            query {
                data: cmsDocumentTypes {
                    id: documentTypeId
                },
                siteData: cmsSites {
                    id: siteId
                }
            }
        `;

        const results: { data: { id: number }[]; siteData: { id: number }[] } = await AwaitHelper.execute(
            OmniHiveClient.getSingleton().graphClient(this.graphUrl, query)
        );

        const formattedResults: { typeIds: number[]; siteIds: number[] } = {
            typeIds: results.data.map((data: { id: number }) => data.id),
            siteIds: results.siteData.map((data: { id: number }) => data.id),
        };

        return formattedResults;
    };

    private getFullDocuments = async (siteId: number, typeId: number): Promise<any> => {
        const query = `
            query {
                data: storedProcedures {
                    doc: api_12Stone_Custom_Cms_GetDynamicDocumentsByTypeId(SiteId: ${siteId}, DocumentTypeId: ${typeId})
                },
            }
        `;

        const results = await OmniHiveClient.getSingleton().graphClient(this.graphUrl, query);

        if (results.data[0].doc[0]) {
            return results.data[0].doc[0];
        } else {
            return undefined;
        }
    };
}
