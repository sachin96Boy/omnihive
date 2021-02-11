import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { IGraphEndpointWorker } from "@withonevision/omnihive-core/interfaces/IGraphEndpointWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-core/models/HiveWorkerBase";
import dayjs from "dayjs";
import { runQuery } from "../../lib/helpers/GraphHelper";
import { WatchContent } from "../../lib/models/WatchModels";
import { transformDataToWatchContent } from "../common/DataToWatchContent";

export default class getPastMessages
    extends HiveWorkerBase
    implements IGraphEndpointWorker {
    public execute = async (): Promise<WatchContent | {}> => {
        const query = `
          query {
              proc: storedProcedures { 
                  document: api_12Stone_Custom_Cms_GetDynamicDocumentsByTypeId(DocumentTypeId: 2, SiteId: 7)
              }
          }
      `;

        const results: any = await AwaitHelper.execute(runQuery(query));

        const documentData: any = results.proc[0].document[0];

        const documents: WatchContent[] = documentData
            .map((doc: any) => {
                return transformDataToWatchContent(doc);
            })
            .filter((x: WatchContent | undefined) => x);

        return documents.sort((a, b) => {
            return dayjs(b.date).unix() - dayjs(a.date).unix();
        });
    };
}
