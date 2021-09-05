---
title: HiveWorker
---

## Properties

### type

-   type: string
-   default: ""

### name

-   type: string
-   default: ""

### package

-   type: string
-   default: ""

### version

-   type: string
-   default: ""

### importPath

-   type: string
-   default: ""

### default

-   type: boolean
-   default: true

### enabled

-   type: boolean
-   default: true

### metadata

-   type: any
-   default: {}

## Code

```
export class HiveWorker {
    public type: string = "";
    public name: string = "";
    public package: string = "";
    public version: string = "";
    public importPath: string = "";
    public default: boolean = true;
    public enabled: boolean = true;
    public metadata: any = {};
}
```
