---
title: PubSubListener
---

## Properties

### channelName

-   type: string
-   default: ""

### eventName

-   type: string
-   default: ""

### callback

-   type: any | undefined
-   default: undefined

## Code

```ts
export class PubSubListener {
    public channelName: string = "";
    public eventName: string = "";
    public callback: any | undefined = undefined;
}
```
