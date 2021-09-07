---
title: Storage Worker
---

### Interface Name: IStorageWorker

## Required Functions:

### exists

-   <strong>arguments</strong>: (key: string)
-   <strong>returns</strong>: Promise&lt;boolean&gt;
-   <strong>purpose</strong>: Verify the key exists

### get&lt;T extends unknown&gt;

-   <strong>arguments</strong>: (key: string)
-   <strong>returns</strong>: Promise&lt;T | undefined&gt;
-   <strong>purpose</strong>: Retrieve the value for the provided key.

### remove

-   <strong>arguments</strong>: (key: string)
-   <strong>returns</strong>: Promise&lt;boolean&gt;
-   <strong>purpose</strong>: Remove the key/value pair for the provided key.

### set&lt;T extends unknown&gt;

-   <strong>arguments</strong>: (key: string, model: T)
-   <strong>returns</strong>: Promise&lt;boolean&gt;
-   <strong>purpose</strong>: Set the value for the provided key.
