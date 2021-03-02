import { OmniHiveClient } from "@withonevision/omnihive-client";
import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
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
            const idList: { [typeId: number]: string[] } = {};
            const processedIds: string[] = [];

            const elasticWorker = this.getWorker(HiveWorkerType.Unknown, "ohElastic") as ElasticWorker;

            await AwaitHelper.execute(elasticWorker.init(elasticWorker.config));

            this.graphUrl = this.config.metadata.mpGraphUrl;

            const documentDataIds: { typeIds: number[]; siteIds: number[] } = await AwaitHelper.execute<{
                typeIds: number[];
                siteIds: number[];
            }>(this.getDocumentTypeIds());

            for (const siteId of documentDataIds.siteIds) {
                await Promise.all(
                    documentDataIds.typeIds.map(async (typeId) => {
                        // for (const typeId of documentDataIds.typeIds) {
                        console.log(
                            chalk.yellow(
                                `(${dayjs().format(
                                    "YYYY-MM-DD HH:mm:ss"
                                )}) Started processing => siteId: ${siteId} typeId: ${typeId}`
                            )
                        );

                        let docList = await AwaitHelper.execute<any>(this.getFullDocuments(siteId, typeId));
                        docList = docList?.filter(
                            (x: any) => !processedIds.some((y: string) => y === x.DocumentId.toString())
                        );

                        if (docList && docList.length > 0) {
                            docList.forEach((x: any) => {
                                if (!idList[typeId]) {
                                    idList[typeId] = [];
                                }

                                idList[typeId].push(x.DocumentId.toString());
                            });

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
                                            x[key] = x[key]
                                                .replace(/<[^>]*>/g, "")
                                                .replace(/"/g, '\\"')
                                                .trim();
                                            continue;
                                        }

                                        if (dayjs(x[key]).isValid()) {
                                            x[key] = dayjs(x[key]).format("YYYY-MM-DDThh:mm:ss");
                                            continue;
                                        }
                                    }
                                    elasticIdList.push(x.DocumentId.toString());
                                });

                                await AwaitHelper.execute(
                                    elasticWorker.upsert(`cms-${typeId}`, "DocumentId", elasticIdList, docChunk)
                                );

                                elasticIdList.forEach((id: string) => processedIds.push(id));
                            }
                        }

                        console.log(
                            chalk.greenBright(
                                `(${dayjs().format(
                                    "YYYY-MM-DD HH:mm:ss"
                                )}) Completed processing => siteId: ${siteId} typeId: ${typeId}`
                            )
                        );
                    })
                );
            }

            if (elasticWorker.client && Object.keys(idList).length > 0) {
                for (const typeId in idList) {
                    console.log(
                        chalk.gray(
                            `(${dayjs().format("YYYY-MM-DD HH:mm:ss")}) Removing unused Ids => typeId: ${typeId}`
                        )
                    );

                    await AwaitHelper.execute(
                        elasticWorker.removeUnused("cms-" + typeId, "DocumentId", idList[typeId])
                    );

                    console.log(
                        chalk.greenBright(
                            `(${dayjs().format(
                                "YYYY-MM-DD HH:mm:ss"
                            )}) Completed removing unused Ids => typeId: ${typeId}`
                        )
                    );
                }
            }

            return;
        } catch (err) {
            console.log(chalk.redBright(JSON.stringify(serializeError(err))));
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
