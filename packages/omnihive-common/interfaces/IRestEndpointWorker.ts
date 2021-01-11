import * as core from "express-serve-static-core";
import swaggerUi from "swagger-ui-express";
import { IHiveWorker } from "./IHiveWorker";

export interface IRestEndpointWorker extends IHiveWorker {
    getSwaggerDefinition: () => swaggerUi.JsonObject | undefined;
    register: (app: core.Express, restRoot: string) => Promise<void>;
}