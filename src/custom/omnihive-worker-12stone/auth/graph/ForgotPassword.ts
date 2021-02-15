import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { IGraphEndpointWorker } from "@withonevision/omnihive-core/interfaces/IGraphEndpointWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-core/models/HiveWorkerBase";
import { serializeError } from "serialize-error";
import { danyPost } from "../../lib/helpers/DanyHelper";
import DanyService from "../../lib/services/DanyService";

export default class ForgotPassword
    extends HiveWorkerBase
    implements IGraphEndpointWorker {
    public execute = async (customArgs: any): Promise<any> => {
        try {
            // Get Metadata
            DanyService.getSingleton().getMetaData("ForgotPassword");

            const result = await AwaitHelper.execute(
                danyPost("/Security/ForgotPassword", customArgs)
            );

            return result.data;
        } catch (err) {
            console.log(JSON.stringify(serializeError(err)));
            return err;
        }
    };
}
