import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { IGraphEndpointWorker } from "@withonevision/omnihive-core/interfaces/IGraphEndpointWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-core/models/HiveWorkerBase";
import { serializeError } from "serialize-error";
import { danyPost } from "../../lib/helpers/DanyHelper";
import DanyService from "../../lib/services/DanyService";

class SignInArgs {
    userName: string = "";
    password: string = "";
}

export default class SignIn
    extends HiveWorkerBase
    implements IGraphEndpointWorker {
    public execute = async (customArgs: any): Promise<any> => {
        try {
            if (customArgs.data || customArgs.data.length > 0) {
                throw new Error("Unauthorized");
            }

            // Get Metadata
            DanyService.getSingleton().getMetaData("SignIn");

            // Sanitize arguments
            const trueArgs: any = {};

            Object.keys(customArgs).forEach((key: string) => {
                if (key !== "data") {
                    trueArgs[key] = customArgs[key];
                }
            });

            // Validate arguments
            this.checkObjectStructure(SignInArgs, trueArgs);

            const result = await AwaitHelper.execute(
                danyPost("/Security/Login", customArgs)
            );

            DanyService.getSingleton().authToken =
                result.data.AuthenticationToken;

            return result.data;
        } catch (err) {
            console.log(JSON.stringify(serializeError(err)));
            return {};
        }
    };
}
