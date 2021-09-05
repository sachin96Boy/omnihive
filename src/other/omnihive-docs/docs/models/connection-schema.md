---
title: ConnectionSchema
---

## Properties

### workerName

-   type: string
-   default: ""

### tables

-   type: <a href="./table-schema">TableSchema</a>[]
-   default: []

### procFunctions

-   type: <a href="./proc-function-schema">ProcFunctionSchema</a>[]
-   default: []

## Code

```
export class ConnectionSchema {
    public workerName: string = "";
    public tables: TableSchema[] = [];
    public procFunctions: ProcFunctionSchema[] = [];
}
```
