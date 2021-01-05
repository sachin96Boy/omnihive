import { Drone } from "@withonevision/omnihive-hive-common/models/Drone";
import { StoredProcSchema } from "@withonevision/omnihive-hive-common/models/StoredProcSchema";
import { TableSchema } from "@withonevision/omnihive-hive-common/models/TableSchema";
import { IDatabaseWorker } from "./IDatabaseWorker";
import { IHiveWorker } from "./IHiveWorker";
export interface IGraphBuildWorker extends IHiveWorker {
    buildDatabaseWorkerSchema: (databaseWorker: IDatabaseWorker, schema: { tables: TableSchema[], storedProcs: StoredProcSchema[] }, drones: Drone[]) => string;
}