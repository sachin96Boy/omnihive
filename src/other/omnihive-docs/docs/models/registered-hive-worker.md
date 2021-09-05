---
title: RegisteredHiveWorker
---

## Properties

### instance

-   type: any
-   default: undefined

### isBoot

-   type: boolean
-   default: false

### isCore

-   type: boolean
-   default: false

## Code

```
export class RegisteredHiveWorker extends HiveWorker {
    public instance: any;
    public isBoot: boolean = false;
    public isCore: boolean = false;
}
```
