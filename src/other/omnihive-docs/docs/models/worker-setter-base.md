---
title: WorkerSetterBase
---

## Properties

### serverSettings

-   type: <a href="./server-settings">ServerSettings</a>
-   default: default <a href="./server-settings">ServerSettings</a>

### initWorkers

-   type: function
-   arguments: (configs: <a href="./hive-worker">HiveWorker</a>[])
-   returns: Promise&lt;void&gt;

### pushWorker

-   type: function
-   arguments: (hiveWorker: <a href="./hive-worker">HiveWorker</a>)
-   returns: Promise&lt;void&gt;

## Code

```
export abstract class WorkerSetterBase extends WorkerGetterBase {
    public serverSettings: ServerSettings = new ServerSettings();
    public initWorkers: (configs: HiveWorker[]) => Promise<void>;
    public pushWorker: (hiveWorker: HiveWorker) => Promise<void>;
}
```
