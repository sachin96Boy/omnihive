---
title: Graph Builder Worker
---

### Interface Name: IGraphBuilderWorker

## Required Functions:

### buildDatabaseWorkerSchema

-   <strong>arguments</strong>: ( databaseWorker: <a href="./database-worker">IDatabaseWorker</a>, connectionSchema: <a href="../models/connection-schema">
        ConnectionSchema
    </a> | undefined )
-   <strong>returns</strong>: string
-   <strong>purpose</strong>: Builds the database worker schema.
