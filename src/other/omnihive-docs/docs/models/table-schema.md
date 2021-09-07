---
title: TableSchema
---

## Properties

### schemaName

-   type: string
-   default: ""

### tableName

-   type: string
-   default: ""

### tableNameCamelCase

-   type: string
-   default: ""

### tableNamePascalCase

-   type: string
-   default: ""

### columnNameDatabase

-   type: string
-   default: ""

### columnNameEntity

-   type: string
-   default: ""

### columnTypeDatabase

-   type: string
-   default: ""

### columnTypeEntity

-   type: string
-   default: ""

### columnPosition

-   type: number
-   default: 0

### columnIsNullable

-   type: boolean
-   default: true

### columnIsIdentity

-   type: boolean
-   default: false

### columnIsPrimaryKey

-   type: boolean
-   default: false

### columnIsForeignKey

-   type: boolean
-   default: false

### columnForeignKeyTableName

-   type: string
-   default: ""

### columnForeignKeyTableNameCamelCase

-   type: string
-   default: ""

### columnForeignKeyTableNamePascalCase

-   type: string
-   default: ""

### columnForeignKeyColumnName

-   type: string
-   default: ""

## Code

```ts
export class TableSchema {
    public schemaName: string = "";
    public tableName: string = "";
    public tableNameCamelCase: string = "";
    public tableNamePascalCase: string = "";
    public columnNameDatabase: string = "";
    public columnNameEntity: string = "";
    public columnTypeDatabase: string = "";
    public columnTypeEntity: string = "";
    public columnPosition: number = 0;
    public columnIsNullable: boolean = true;
    public columnIsIdentity: boolean = false;
    public columnIsPrimaryKey: boolean = false;
    public columnIsForeignKey: boolean = false;
    public columnForeignKeyTableName: string = "";
    public columnForeignKeyTableNameCamelCase: string = "";
    public columnForeignKeyTableNamePascalCase: string = "";
    public columnForeignKeyColumnName: string = "";
}
```
