---
title: HiveWorkerMetadataDatabase
---

## Properties

### connectionPoolLimit

-   type: number
-   default: 25

### databaseName

-   type: string
-   default: ""

### getProcFunctionSqlFile

-   type: string
-   default: ""

### getSchemaSqlFile

-   type: string
-   default: ""

### ignoreSchema

-   type: boolean
-   default: true

### password

-   type: string
-   default: ""

### procFunctionGraphSchemaName

-   type: string
-   default: ""

### requireSsl

-   type: boolean
-   default: false

### rowLimit

-   type: number
-   default: 0

### schemas

-   type: string[]
-   default: []

### serverAddress

-   type: string
-   default: ""

### serverPort

-   type: number
-   default: 0

### sslCertPath

-   type: string
-   default: ""

### urlRoute

-   type: string
-   default: ""

### userName

-   type: string
-   default: ""

## Code

```
export class HiveWorkerMetadataDatabase {
    public connectionPoolLimit: number = 25;
    public databaseName: string = "";
    public getProcFunctionSqlFile: string = "";
    public getSchemaSqlFile: string = "";
    public ignoreSchema: boolean = true;
    public password: string = "";
    public procFunctionGraphSchemaName: string = "";
    public requireSsl: boolean = false;
    public rowLimit: number = 0;
    public schemas: string[] = [];
    public serverAddress: string = "";
    public serverPort: number = 0;
    public sslCertPath: string = "";
    public urlRoute: string = "";
    public userName: string = "";
}
```
