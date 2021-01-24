import { IHiveWorker } from "./IHiveWorker";

export interface IRestEndpointWorker extends IHiveWorker {
    getSwaggerDefinition: () => any | undefined;
    register: (app: any, restRoot: string) => Promise<void>;
}
