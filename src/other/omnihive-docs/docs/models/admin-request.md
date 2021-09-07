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

```ts
export class AdminRequest<T = {}> {
    public adminPassword: string = "";
    public data?: T | undefined = undefined;
}
```
