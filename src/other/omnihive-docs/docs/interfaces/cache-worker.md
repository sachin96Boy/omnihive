---
title: Cache Worker Interface
---

### Interface Name: ICacheWorker

## Required Functions:

### exists

-   <strong>arguments</strong>: (key: string)
-   <strong>returns</strong>: Promise&lt;boolean&gt;
-   <strong>purpose</strong>: Returns true if the key value exists in the cache

### get

-   <strong>arguments</strong>: (key: string)
-   <strong>returns</strong>: Promise&lt;string | undefined&gt;
-   <strong>purpose</strong>: Returns the cached value from the cache key provided

### set

-   <strong>arguments</strong>: (key: string, value: string, expireSeconds: number)
-   <strong>returns</strong>: Promise&lt;boolean&gt;
-   <strong>purpose</strong>: Sets the cached value with the provided cache key. The value will expire in the number of
    seconds provided. Returns true for success and false for failure.

### remove

-   <strong>arguments</strong>: (key: string)
-   <strong>returns</strong>: Promise&lt;boolean&gt;
-   <strong>purpose</strong>: Remove the cached value stored with the provided key.
