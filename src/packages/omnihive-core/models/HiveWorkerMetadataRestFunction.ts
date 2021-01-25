import { RestMethod } from "../enums/RestMethod";

export class HiveWorkerMetadataRestFunction {
    public methodUrl: string = "";
    public restMethod: RestMethod = RestMethod.POST;
    public isSystem: boolean = false;
}
