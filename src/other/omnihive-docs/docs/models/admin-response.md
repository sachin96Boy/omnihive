---
title: AdminEvent
---

## Properties

### data

-   type: T | undefined
-   default: undefined

### requestComplete

-   type: boolean
-   default: true

### requestError

-   type: string | undefined
-   default: undefined

## Code

```
export class AdminResponse<T = {}> {
    public data?: T | undefined = undefined;
    public requestComplete?: boolean = true;
    public requestError?: string | undefined = undefined;
}
```
