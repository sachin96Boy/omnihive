import { IHiveWorker } from "./IHiveWorker";

export interface IRestEndpointWorker extends IHiveWorker {
    getSwaggerDefinition: () => any | undefined;
    execute: (headers: any, url: string, body: any) => Promise<[{} | undefined, number]>;
}
