---
title: Database Worker
---

### Interface Name: IDatabaseWorker

## Required Variables:

### connection

-   type: string

## Required Functions:

### executeQuery

-   <strong>arguments</strong>: (query: string, disableLog?: boolean)
-   <strong>returns</strong>: Promise&lt;any[][]&gt;
-   <strong>purpose</strong>: Execute a database custom query.

### executeProcedure

-   <strong>arguments</strong>: (procFunctionSchema: <a href="../models/proc-function-schema">ProcFunctionSchema</a>[], args:
    &#123; name: string; value: any; isString: boolean &#125;[])
-   <strong>returns</strong>: Promise&lt;any[][]&gt;
-   <strong>purpose</strong>: Execute a database procedure

### getSchema

-   <strong>arguments</strong>: none
-   <strong>returns</strong>: Promise&lt;<a href="../models/connection-schema">ConnectionSchema</a>&gt;
-   <strong>purpose</strong>: Retrieve the database schema
