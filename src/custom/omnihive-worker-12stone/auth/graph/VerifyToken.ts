import { IGraphEndpointWorker } from "@withonevision/omnihive-core/interfaces/IGraphEndpointWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-core/models/HiveWorkerBase";
import { serializeError } from "serialize-error";
import { runQuery } from "../../lib/helpers/GraphHelper";

class VerifyTokenArgs {
    AuthToken: string = "";
}

export default class VerifyToken extends HiveWorkerBase implements IGraphEndpointWorker {
    public execute = async (customArgs: VerifyTokenArgs): Promise<any> => {
        try {
            const query = `
                query {
                    storedProcedures {
                        data: api_12Stone_Custom_Session_Verify(DomainId: "1", SessionKey: "${customArgs.AuthToken.replace(
                            "BEARER ",
                            ""
                        )}")
                    }
                }
            `;
            const results = (await runQuery(query)).storedProcedures[0].data[0][0];
            delete results.SessionId;
            delete results.SessionKey;

            return results;
        } catch (err) {
            console.log(JSON.stringify(serializeError(err)));
            return err;
        }
    };
}
