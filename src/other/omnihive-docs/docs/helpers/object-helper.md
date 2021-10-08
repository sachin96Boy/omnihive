---
title: Object Helper
---

## Functions:

### create&lt;T extends unknown&gt;

-   <strong>arguments</strong>: (type: &#123; new (): T &#125;, model: any | null)
-   <strong>returns</strong>: T
-   <strong>purpose</strong>: Create an object of the provided type.

### createStrict&lt;T extends unknown&gt;

-   <strong>arguments</strong>: (type: &#123; new (): T &#125;, model: any | null)
-   <strong>returns</strong>: T
-   <strong>purpose</strong>: Create an object of the provided type. An error is thrown if the model structure does not
    match the given type.

### createArray&lt;T extends unknown&gt;

-   <strong>arguments</strong>: (type: &#123; new (): T &#125;, model: any[])
-   <strong>returns</strong>: T[]
-   <strong>purpose</strong>: Create an object array of the provided type.

### createArrayStrict&lt;T extends unknown&gt;

-   <strong>arguments</strong>: (type: &#123; new (): T &#125;, model: any[])
-   <strong>returns</strong>: T[]
-   <strong>purpose</strong>: Create an object array of the provided type. An error is thrown if the model structure
    does not match the given type.
