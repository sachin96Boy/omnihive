
import { StoredProcSchema } from "@withonevision/omnihive-hive-common/models/StoredProcSchema";
import { TableSchema } from "@withonevision/omnihive-hive-common/models/TableSchema";
import { IHiveWorker } from "./IHiveWorker";

export interface IDatabaseWorker extends IHiveWorker {

    executeQuery: (query: string) => Promise<any[][]>;
    executeStoredProcedure: (storedProcSchema: StoredProcSchema, args: { name: string, value: any, isString: boolean }[]) => Promise<any[][]>;
    getSchema: () => Promise<{ tables: TableSchema[], storedProcs: StoredProcSchema[] }>;
}
