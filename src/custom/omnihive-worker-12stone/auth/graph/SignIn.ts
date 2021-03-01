import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { IGraphEndpointWorker } from "@withonevision/omnihive-core/interfaces/IGraphEndpointWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-core/models/HiveWorkerBase";
import { serializeError } from "serialize-error";
import { danyPost } from "../../lib/helpers/DanyHelper";
import DanyService from "../../lib/services/DanyService";

class SignInArgs {
    UserName: string = "";
    Password: string = "";
}

export default class SignIn extends HiveWorkerBase implements IGraphEndpointWorker {
    public execute = async (customArgs: any): Promise<any> => {
        try {
            if (customArgs.Data) {
                throw new Error("Unauthorized");
            }

            // Get Metadata
            DanyService.getSingleton().setMetaData(this.config.metadata);

            // Sanitize arguments
            const trueArgs: any = {};

            Object.keys(customArgs).forEach((key: string) => {
                if (key !== "Data") {
                    trueArgs[key] = customArgs[key];
                }
            });

            // Validate arguments
            this.checkObjectStructure(SignInArgs, trueArgs);

            const result = await AwaitHelper.execute(danyPost("/Security/Login", customArgs));

            return result.data;
        } catch (err) {
            console.log(JSON.stringify(serializeError(err)));
            return err;
        }
    };
}
