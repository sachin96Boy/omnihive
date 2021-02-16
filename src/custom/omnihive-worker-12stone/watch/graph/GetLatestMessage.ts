import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { IGraphEndpointWorker } from "@withonevision/omnihive-core/interfaces/IGraphEndpointWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-core/models/HiveWorkerBase";
import dayjs from "dayjs";
import { serializeError } from "serialize-error";
import { runQuery } from "../../lib/helpers/GraphHelper";
import { WatchContent } from "../../lib/models/WatchModels";
import { getMessageById } from "../common/GetMessaegById";

export default class GetLatestMessage extends HiveWorkerBase implements IGraphEndpointWorker {
    private getLatestMessageId = async (): Promise<number | undefined> => {
        try {
            let latestSiteDocId: number = 0;
            const latestMessageQuery = `
          query {
              campaign: cmsCampaignSiteDocuments(campaignId: "= 8", startDate: "<= GETDATE()", endDate: "> GETDATE()") {
                  id: siteDocumentId,
                  viewOrder,
                  startDate
              }
          }
      `;
            const response: any = await AwaitHelper.execute(runQuery(latestMessageQuery));

            const validSiteDocuments = response.campaign;

            if (validSiteDocuments.length > 1) {
                let latestStartDate = dayjs().subtract(100, "year");
                let topViewOrder = 0;
                let topId = 0;

                validSiteDocuments.forEach((doc: any) => {
                    if (topViewOrder < doc.viewOrder) {
                        topViewOrder = doc.viewOrder;
                        topId = doc.id;
                    } else if (topViewOrder === doc.viewOrder && dayjs(doc.startDate).isAfter(latestStartDate)) {
                        latestStartDate = dayjs(doc.startDate);
                        topId = doc.id;
                    }
                });

                latestSiteDocId = topId;
            } else if (validSiteDocuments.length === 1) {
                latestSiteDocId = validSiteDocuments[0].id;
            } else {
                latestSiteDocId = 0;
            }

            return latestSiteDocId;
        } catch (err) {
            console.log(JSON.stringify(serializeError(err)));
            return undefined;
        }
    };

    public execute = async (_customArgs: any): Promise<WatchContent | {}> => {
        try {
            const latestSiteDocId = await this.getLatestMessageId();

            const latestMessage = await getMessageById(latestSiteDocId);

            if (latestMessage) {
                return latestMessage;
            }

            return {};
        } catch (err) {
            console.log(JSON.stringify(serializeError(err)));
            return {};
        }
    };
}
