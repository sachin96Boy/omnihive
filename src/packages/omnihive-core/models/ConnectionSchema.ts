import { ProcSchema } from "./ProcSchema";
import { TableSchema } from "./TableSchema";

export class ConnectionSchema {
    public workerName: string = "";
    public tables: TableSchema[] = [];
    public procs: ProcSchema[] = [];
}
