import { IDatabaseWorker } from "@withonevision/omnihive-core/interfaces/IDatabaseWorker";
import * as knex from "knex";

export interface IKnexDatabaseWorker extends IDatabaseWorker {
    connection: knex;
}
