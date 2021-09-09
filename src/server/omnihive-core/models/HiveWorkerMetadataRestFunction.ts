import { RestMethod } from "../enums/RestMethod.js";

export class HiveWorkerMetadataRestFunction {
    public restMethod: RestMethod = RestMethod.POST;
    public urlRoute: string = "";
    public data: any = {};
}
