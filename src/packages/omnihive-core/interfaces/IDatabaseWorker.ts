import { ConnectionSchema } from "../models/ConnectionSchema";
import { ProcSchema } from "../models/ProcSchema";
import { IHiveWorker } from "./IHiveWorker";

export interface IDatabaseWorker extends IHiveWorker {
    connection: any;
    executeQuery: (query: string, disableLog?: boolean) => Promise<any[][]>;
    executeProcedure: (
        procSchema: ProcSchema,
        args: { name: string; value: any; isString: boolean }[]
    ) => Promise<any[][]>;
    getSchema: () => Promise<ConnectionSchema>;
}
