---
title: ClientSettings
---

## Properties

### rootUrl

-   type: string
-   default: ""

### workers

-   type: <a href="./hive-worker">HiveWorker</a>[] | undefined
-   default: undefined

### tokenMetadata

-   type: any | undefined
-   default: undefined

## Code

```ts
export class ClientSettings {
    public rootUrl: string = "";
    public workers?: HiveWorker[] | undefined = undefined;
    public tokenMetadata?: any | undefined = undefined;
}
```
