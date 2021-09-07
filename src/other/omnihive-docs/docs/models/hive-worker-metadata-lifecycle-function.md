---
title: HiveWorkerMetadataLifecycleFunction
---

## Properties

### lifecycleAction

-   type: <a href="../enums/lifecycle-worker-action">LifecycleWorkerAction</a>
-   default: <a href="../enums/lifecycle-worker-action">LifecycleWorkerAction</a>.None

### lifecycleStage

-   type: <a href="../enums/lifecycle-worker-stage">LifecycleWorkerStage</a>
-   default: <a href="../enums/lifecycle-worker-stage">LifecycleWorkerStage</a>.None

### lifecycleOrder

-   type: number
-   default: 0

### lifecycleWorker

-   type: string
-   default: ""

### lifecycleSchema

-   type: string
-   default: ""

### lifecycleTables

-   type: string[]
-   default: []

## Code

```ts
export class HiveWorkerMetadataLifecycleFunction {
    public lifecycleAction: LifecycleWorkerAction = LifecycleWorkerAction.None;
    public lifecycleStage: LifecycleWorkerStage = LifecycleWorkerStage.None;
    public lifecycleOrder: number = 0;
    public lifecycleWorker: string = "";
    public lifecycleSchema: string = "";
    public lifecycleTables: string[] = [];
}
```
