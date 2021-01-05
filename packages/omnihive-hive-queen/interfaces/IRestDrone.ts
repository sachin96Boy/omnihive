import * as core from "express-serve-static-core";
import { IDrone } from "./IDrone";
import swaggerUi from "swagger-ui-express";

export interface IRestDrone extends IDrone {
    getSwaggerDefinition: () => swaggerUi.JsonObject;
    register: (app: core.Express, restRoot: string) => Promise<void>;
}