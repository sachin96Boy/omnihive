import { GraphQLSchema } from "graphql";
import { ConnectionSchema } from "../models/ConnectionSchema.js";
import { IDatabaseWorker } from "./IDatabaseWorker.js";
import { IHiveWorker } from "./IHiveWorker.js";

export interface IGraphBuildWorker extends IHiveWorker {
    buildDatabaseWorkerSchema: (
        databaseWorker: IDatabaseWorker,
        connectionSchema: ConnectionSchema | undefined
    ) => Promise<string | GraphQLSchema | undefined>;
}
