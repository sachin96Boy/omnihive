import { IHiveWorker } from "@withonevision/omnihive-core/interfaces/IHiveWorker";
import express from "express";
import swaggerUi from "swagger-ui-express";

export interface IRestEndpointWorker extends IHiveWorker {
    getSwaggerDefinition: () => swaggerUi.JsonObject | undefined;
    register: (app: express.Express, restRoot: string) => Promise<void>;
}
