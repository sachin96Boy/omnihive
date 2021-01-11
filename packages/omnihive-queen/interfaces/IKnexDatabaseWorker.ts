import { IDatabaseWorker } from "./IDatabaseWorker";
import * as knex from "knex";

export interface IKnexDatabaseWorker extends IDatabaseWorker {
    connection: knex;
}