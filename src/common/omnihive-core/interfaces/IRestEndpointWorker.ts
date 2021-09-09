import { RestEndpointExecuteResponse } from "../models/RestEndpointExecuteResponse.js";
import { IHiveWorker } from "./IHiveWorker.js";

export interface IRestEndpointWorker extends IHiveWorker {
    getSwaggerDefinition: () => any | undefined;
    execute: (headers: any, url: string, body: any) => Promise<RestEndpointExecuteResponse>;
}
