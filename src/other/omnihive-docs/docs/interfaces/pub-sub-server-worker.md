---
title: Pub Sub Server Worker
---

### Interface Name: IPubSubServerWorker

## Required Functions:

### addListener

-   <strong>arguments</strong>: (channelName: string, eventName: string, callback: any)
-   <strong>returns</strong>: void
-   <strong>purpose</strong>: Add a listener to the server.

### emit

-   <strong>arguments</strong>: (channelName: string, eventName: string, message: &#123;&#125;)
-   <strong>returns</strong>: Promise&lt;void&gt;
-   <strong>purpose</strong>: Emit a PubSub event on the provided channel.

### getListeners

-   <strong>arguments</strong>: none
-   <strong>returns</strong>: <a href="../models/pub-sub-listener">PubSubListener</a>[]
-   <strong>purpose</strong>: Retrieve the active listeners.

### removeListener

-   <strong>arguments</strong>: (channelName: string, eventName: string)
-   <strong>returns</strong>: void
-   <strong>purpose</strong>: Remove a listener.
