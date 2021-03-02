import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { IGraphEndpointWorker } from "@withonevision/omnihive-core/interfaces/IGraphEndpointWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-core/models/HiveWorkerBase";
import { serializeError } from "serialize-error";
import ElasticWorker, { ElasticSearchFieldModel } from "src/custom/omnihive-worker-elastic";
import { PaginationModel } from "../../lib/models/PaginationModel";
import { WatchContent } from "../../lib/models/WatchModels";
import { getMessageById } from "../common/GetMessaegById";
import getPastMessages from "./GetPastMessages";

export default class MessageSearch extends HiveWorkerBase implements IGraphEndpointWorker {
    public execute = async (customArgs: any | undefined): Promise<PaginationModel<WatchContent> | {}> => {
        try {
            const query = customArgs?.query ?? "";
            const page = customArgs?.page ?? 1;
            const limit = customArgs.limit ?? 100;

            if (!query) {
                const pastMessageFunction = new getPastMessages();
                const args = {
                    page: page,
                    limit: limit,
                };

                return AwaitHelper.execute<PaginationModel<WatchContent>>(pastMessageFunction.execute(args));
            }

            const elasticWorker: ElasticWorker = this.getWorker(HiveWorkerType.Unknown, "ohElastic") as ElasticWorker;

            if (elasticWorker) {
                const searchFields: ElasticSearchFieldModel[] = this.buildSearchFields();

                const results = await AwaitHelper.execute(
                    elasticWorker.search("cms-2", query, searchFields, page - 1, limit)
                );

                const totalCount: number = results.hits.total.value;
                const endingIndex: number = page * limit;

                const checkData = results.hits.hits.map((x: any) => x._source);

                console.log(checkData);

                const parsedData: { doc: WatchContent; score: number }[] = await Promise.all(
                    results.hits.hits.map(async (x: any) => await this.buildFinalData(x))
                );

                const finalData: WatchContent[] = parsedData
                    .filter((x) => x)
                    .sort((a, b) => a.score - b.score)
                    .map((x) => x.doc);

                const final: PaginationModel<WatchContent> = {
                    nextPageNumber: totalCount > endingIndex ? page + 1 : undefined,
                    previousPageNumber: page > 1 ? page - 1 : undefined,
                    totalCount: totalCount,
                    data: finalData,
                };

                return final;
            } else {
                throw new Error("Elastic Worker not defined");
            }
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    };

    private buildSearchFields(): ElasticSearchFieldModel[] {
        const searchFields: ElasticSearchFieldModel[] = [];

        searchFields.push({
            name: "Title",
            weight: 0.5,
        });

        searchFields.push({
            name: "Excerpt",
            weight: 0.25,
        });

        searchFields.push({
            name: "Tweetable Quote - Text|Tweetable Quotes|1",
            weight: 0.1,
        });
        searchFields.push({
            name: "Tweetable Quote - Text|Tweetable Quotes|2",
            weight: 0.1,
        });
        searchFields.push({
            name: "Tweetable Quote - Text|Tweetable Quotes|3",
            weight: 0.1,
        });
        searchFields.push({
            name: "Tweetable Quote - Text|Tweetable Quotes|4",
            weight: 0.1,
        });
        searchFields.push({
            name: "Tweetable Quote - Text|Tweetable Quotes|5",
            weight: 0.1,
        });
        searchFields.push({
            name: "Tweetable Quote - Text|Tweetable Quotes|6",
            weight: 0.1,
        });
        searchFields.push({
            name: "Tweetable Quote - Text|Tweetable Quotes|7",
            weight: 0.1,
        });

        searchFields.push({
            name: "Speaker",
            weight: 0.1,
        });

        // searchFields.push({
        //     name: "PublishDate",
        //     weight: 0.045,
        // });

        searchFields.push({
            name: "Content",
            weight: 0.005,
        });

        return searchFields;
    }

    private async buildFinalData(doc: any): Promise<{ doc: WatchContent; score: number } | undefined> {
        if (doc._source.DocumentTypeId === 2) {
            const document = await AwaitHelper.execute<WatchContent | undefined>(
                getMessageById(doc._source.SiteDocumentId)
            );

            if (document) {
                return { doc: document, score: doc._score };
            }
        }

        return undefined;
    }
}
