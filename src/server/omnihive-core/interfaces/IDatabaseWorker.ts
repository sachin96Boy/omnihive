import { ConnectionSchema } from "../models/ConnectionSchema.js";
import { ProcFunctionSchema } from "../models/ProcFunctionSchema.js";
import { IHiveWorker } from "./IHiveWorker.js";

export interface IDatabaseWorker extends IHiveWorker {
    connection: any;
    executeQuery: (query: string, disableLog?: boolean) => Promise<any[][]>;
    executeProcedure: (
        procFunctionSchema: ProcFunctionSchema[],
        args: { name: string; value: any; isString: boolean }[]
    ) => Promise<any[][]>;
    getSchema: () => Promise<ConnectionSchema>;
}
