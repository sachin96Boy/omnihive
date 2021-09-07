---
title: Feature Worker
---

### Interface Name: IFeatureWorker

## Required Functions:

### get &lt;T extends unknown&gt;

-   <strong>arguments</strong>: (name: string, defaultValue?: unknown)
-   <strong>returns</strong>: Promise&lt;T | undefined&gt;
-   <strong>purpose</strong>: Retrieves the provided feature value.
