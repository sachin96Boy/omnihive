import { ProcFunctionSchema } from "./ProcFunctionSchema.js";
import { TableSchema } from "./TableSchema.js";

export class ConnectionSchema {
    public workerName: string = "";
    public tables: TableSchema[] = [];
    public procFunctions: ProcFunctionSchema[] = [];
}
