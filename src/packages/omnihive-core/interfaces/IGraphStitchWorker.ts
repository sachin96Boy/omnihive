import { GraphQLSchema } from "graphql";
import { ConnectionSchema } from "../models/ConnectionSchema";
import { IDatabaseWorker } from "./IDatabaseWorker";
import { IHiveWorker } from "./IHiveWorker";

export interface IGraphStitchWorker extends IHiveWorker {
    buildDatabaseWorkerSchema: (
        databaseWorker: IDatabaseWorker,
        connectionSchema: ConnectionSchema | undefined
    ) => GraphQLSchema | undefined;
}
