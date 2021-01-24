import express from "express";
import swaggerUi from "swagger-ui-express";
import { IHiveWorker } from "./IHiveWorker";

export interface IRestEndpointWorker extends IHiveWorker {
    getSwaggerDefinition: () => swaggerUi.JsonObject | undefined;
    register: (app: express.Express, restRoot: string) => Promise<void>;
}
