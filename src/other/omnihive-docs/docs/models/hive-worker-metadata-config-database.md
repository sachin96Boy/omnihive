---
title: HiveWorkerMetadataDatabase
---

## Properties

### configName

-   type: string
-   default: ""

### databaseName

-   type: string
-   default: ""

### password

-   type: string
-   default: ""

### requireSsl

-   type: boolean
-   default: false

### serverAddress

-   type: string
-   default: ""

### serverPort

-   type: number
-   default: 0

### sslCertPath

-   type: string
-   default: ""

### userName

-   type: string
-   default: ""

## Code

```ts
export class HiveWorkerMetadataConfigDatabase {
    public configName: string = "";
    public databaseName: string = "";
    public password: string = "";
    public requireSsl: boolean = false;
    public serverAddress: string = "";
    public serverPort: number = 0;
    public sslCertPath: string = "";
    public userName: string = "";
}
```
