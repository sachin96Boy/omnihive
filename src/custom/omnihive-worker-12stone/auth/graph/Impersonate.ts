import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { IGraphEndpointWorker } from "@withonevision/omnihive-core/interfaces/IGraphEndpointWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-core/models/HiveWorkerBase";
import { serializeError } from "serialize-error";
import { danyPost } from "../../lib/helpers/DanyHelper";
import DanyService from "../../lib/services/DanyService";

export default class Impersonate extends HiveWorkerBase implements IGraphEndpointWorker {
    public execute = async (customArgs: any): Promise<any> => {
        try {
            // Get Metadata
            DanyService.getSingleton().setMetaData(this.config.metadata);

            const impersonateArgs = {
                UserId: customArgs.UserId,
            };

            const result = await AwaitHelper.execute(
                danyPost("/Security/Impersonate", impersonateArgs, customArgs.Authorization)
            );

            return result.data;
        } catch (err) {
            console.log(JSON.stringify(serializeError(err)));
            return err;
        }
    };
}
