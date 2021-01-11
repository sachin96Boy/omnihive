import { StoredProcSchema } from "../models/StoredProcSchema";
import { TableSchema } from "../models/TableSchema";
import { IDatabaseWorker } from "./IDatabaseWorker";
import { IHiveWorker } from "./IHiveWorker";

export interface IGraphBuildWorker extends IHiveWorker {
    buildDatabaseWorkerSchema: (databaseWorker: IDatabaseWorker, schema: { tables: TableSchema[], storedProcs: StoredProcSchema[] }) => string;
}