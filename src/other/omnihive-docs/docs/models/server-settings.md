---
title: ServerSettings
---

## Properties

### constants

-   type: { [key: string]: unknown }
-   default: {}

### features

-   type: { [key: string]: unknown }
-   default: {}

### workers

-   type: <a href="./hive-worker">HiveWorker</a>[]
-   default: []

## Code

```ts
export class ServerSettings {
    public constants: { [key: string]: unknown } = {};
    public features: { [key: string]: unknown } = {};
    public workers: HiveWorker[] = [];
}
```
