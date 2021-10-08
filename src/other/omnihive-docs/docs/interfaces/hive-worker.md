---
title: Hive Worker
---

### Interface Name: IHiveWorker

## Required Variables:

### config

-   type: <a href="../models/hive-worker">HiveWorker</a>

### registeredWorkers

-   type: <a href="../models/registered-hive-worker">RegisteredHiveWorker</a>[]

### serverSettings

-   type: <a href="../models/server-settings">ServerSettings</a>

## Required Functions:

### checkObjectStructure&lt;T extends object&gt;

-   <strong>arguments</strong>: (type: &#123; new (): T &#125;, model: any | null)
-   <strong>returns</strong>: T
-   <strong>purpose</strong>: Verify the provided model has the same structure as the provided type

### getWorker &lt;T extends <a href="./hive-worker">IHiveWorker</a> | undefined&gt;

-   <strong>arguments</strong>: (type: string, name?: string)
-   <strong>returns</strong>: T | undefined
-   <strong>purpose</strong>: Get the worker of the provided type.

### init

-   <strong>arguments</strong>: (hiveWorker: <a href="../models/hive-worker">HiveWorker</a>)
-   <strong>returns</strong>: Promise&lt;void&gt;
-   <strong>purpose</strong>: Initalize the worker.
