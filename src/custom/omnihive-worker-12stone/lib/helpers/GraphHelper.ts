import { OmniHiveClient } from "@withonevision/omnihive-client";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { serializeError } from "serialize-error";

const graphRootUrl: string = "http://localhost:3001/server1/builder1/ministryPlatform";

export const runQuery = async (query: string): Promise<any> => {
    try {
        if (!query) {
            throw new Error("A query is required.");
        }

        const results = await AwaitHelper.execute(OmniHiveClient.getSingleton().graphClient(graphRootUrl, query));
        return results;
    } catch (err) {
        throw new Error(JSON.stringify(serializeError(err)));
    }
};
