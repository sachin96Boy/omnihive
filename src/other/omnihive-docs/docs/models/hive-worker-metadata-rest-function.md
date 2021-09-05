---
title: HiveWorkerMetadataRestFunction
---

## Properties

### restMethod

-   type: <a href="../enums/rest-method">RestMethod</a>
-   default: <a href="../enums/rest-method">RestMethod</a>.POST

### urlRoute

-   type: string
-   default: ""

### data

-   type: any
-   default: {}

## Code

```
export class HiveWorkerMetadataRestFunction {
    public restMethod: RestMethod = RestMethod.POST;
    public urlRoute: string = "";
    public data: any = {};
}
```
