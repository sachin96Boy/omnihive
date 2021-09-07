---
title: WorkerGetterBase
---

## Properties

### registeredWorkers

-   type: <a href="./registered-hive-worker">RegisteredHiveWorker</a>[]
-   default: []

### getWorker&lt;T extends <a href="../interfaces/hive-worker">IHiveWorker</a> | undefined&gt;

-   type: function
-   arguments: (type: string, name?: string)
-   return: T | undefined

## Code

```ts
export abstract class WorkerGetterBase {
    public registeredWorkers: RegisteredHiveWorker[] = [];
    public getWorker<T extends IHiveWorker | undefined>: (type: string, name?: string) => T | undefined;
}
```
