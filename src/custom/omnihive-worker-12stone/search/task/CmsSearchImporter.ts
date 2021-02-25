import { OmniHiveClient } from "@withonevision/omnihive-client";
import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { CoreServiceFactory } from "@withonevision/omnihive-core/factories/CoreServiceFactory";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { ITaskEndpointWorker } from "@withonevision/omnihive-core/interfaces/ITaskEndpointWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-core/models/HiveWorkerBase";
import { serializeError } from "serialize-error";

export default class CmsSearchImporter extends HiveWorkerBase implements ITaskEndpointWorker {
    private graphUrl = "";

    public execute = async (): Promise<any> => {
        try {
            const worker = await CoreServiceFactory.workerService.getWorker(
                HiveWorkerType.TaskFunction,
                "CmsSearchImporter"
            );

            this.graphUrl = worker?.config.metadata.mpGraphUrl;

            const documentDataIds: { typeIds: number[]; siteIds: number[] } = await AwaitHelper.execute<{
                typeIds: number[];
                siteIds: number[];
            }>(this.getDocumentTypeIds());

            for (const siteId of documentDataIds.siteIds) {
                for (const typeId of documentDataIds.typeIds) {
                    const docList = await AwaitHelper.execute<any>(this.getFullDocuments(siteId, typeId));

                    if (docList && docList.length > 0) {
                        const chunk = 50;
                        for (let i = 0; i < docList.length; i += chunk) {
                            const docChunk = docList.slice(i, i + chunk);
                        }

                        // return documentIds;
                    }

                    console.log(`Completed processing siteId: ${siteId} and typeId: ${typeId}`);
                }
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
