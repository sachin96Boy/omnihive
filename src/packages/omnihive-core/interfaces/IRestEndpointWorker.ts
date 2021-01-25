import { IHiveWorker } from "./IHiveWorker";

export interface IRestEndpointWorker extends IHiveWorker {
    getSwaggerDefinition: () => any | undefined;
    execute: (params: any) => Promise<[{} | undefined, number]>;
}
