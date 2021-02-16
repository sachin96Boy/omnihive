import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { IGraphEndpointWorker } from "@withonevision/omnihive-core/interfaces/IGraphEndpointWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-core/models/HiveWorkerBase";
import { serializeError } from "serialize-error";
import { danyPost } from "../../lib/helpers/DanyHelper";
import DanyService from "../../lib/services/DanyService";

class CreateUserArgs {
    AddressLine1: string = "";
    AddressLine2: string = "";
    City: string = "";
    CustomData: string = "";
    Data: string = "";
    Email: string = "";
    FirstName: string = "";
    LastName: string = "";
    Password: string = "";
    PhoneNumber: string = "";
    PostalCode: string = "";
    State: string = "";
}

export default class CreateUser extends HiveWorkerBase implements IGraphEndpointWorker {
    public execute = async (customArgs: CreateUserArgs): Promise<any> => {
        try {
            // Get Metadata
            DanyService.getSingleton().getMetaData("CreateUser");

            const result = await AwaitHelper.execute(danyPost("/Security/Register", customArgs));

            return result.data;
        } catch (err) {
            console.log(JSON.stringify(serializeError(err)));
            return err;
        }
    };
}
