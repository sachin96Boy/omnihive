---
title: HiveWorkerBase
---

## Properties

### config

-   type: <a href="./hive-worker">HiveWorker</a>
-   default: undefined

### serverSettings

-   type: <a href="./server-settings">ServerSettings</a>
-   default: undefined

### init

-   type: function
-   arguments: (config: <a href="./hive-worker">HiveWorker</a>)
-   returns: Promise&lt;void&gt;

### checkObjectStructure&lt;T extends object&gt;

-   type: function
-   arguments: (type: { new(): T }, model: any | null)
-   returns: T

## Code

```
export abstract class HiveWorkerBase extends WorkerGetterBase implements IHiveWorker {
    public config!: HiveWorker;
    public serverSettings!: ServerSettings;
    public init(config: HiveWorker): => Promise<void>
    public checkObjectStructure<T extends object> (type: { new (): T }, model: any | null): => T;
}
```
