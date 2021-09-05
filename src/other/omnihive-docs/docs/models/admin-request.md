---
title: AdminRequest
---

## Properties

### adminPassword

-   type: string
-   default: ""

### data

-   type: T | undefined
-   default: undefined

## Code

```
export class AdminRequest<T = {}> {
    public adminPassword: string = "";
    public data?: T | undefined = undefined;
}
```
