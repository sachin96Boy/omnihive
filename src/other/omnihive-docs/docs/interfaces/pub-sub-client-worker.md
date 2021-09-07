---
title: Pub Sub Client Worker
---

### Interface Name: IPubSubClientWorker

## Required Functions:

### getListeners

-   <strong>arguments</strong>: none
-   <strong>returns</strong>: <a href="../models/pub-sub-listener">PubSubListener</a>[]
-   <strong>purpose</strong>: Retrieve the PubSub Listeners.

### getJoinedChannels

-   <strong>arguments</strong>: none
-   <strong>returns</strong>: string[]
-   <strong>purpose</strong>: Retrieve the channels the running program has subscribed to.

### addListener

-   <strong>arguments</strong>: (channelName: string, eventName: string, callback?: any)
-   <strong>returns</strong>: void
-   <strong>purpose</strong>: Add a listener to the client.

### removeListener

-   <strong>arguments</strong>: (channelName: string, eventName: string)
-   <strong>returns</strong>: void
-   <strong>purpose</strong>: Remove a listener from the client.

### connect

-   <strong>arguments</strong>: none
-   <strong>returns</strong>: Promise&lt;void&gt;
-   <strong>purpose</strong>: Connect to the PubSub Server.

### disconnect

-   <strong>arguments</strong>: none
-   <strong>returns</strong>: void
-   <strong>purpose</strong>: Disconnect from the PubSub Server.

### emit

-   <strong>arguments</strong>: (channelName: string, eventName: string, message: any)
-   <strong>returns</strong>: void
-   <strong>purpose</strong>: Emit a PubSub event on the provided channel.

### joinChannel

-   <strong>arguments</strong>: (channelName: string)
-   <strong>returns</strong>: void
-   <strong>purpose</strong>: Join a PubSub channel.

### leaveChannel

-   <strong>arguments</strong>: (channelName: string)
-   <strong>returns</strong>: void
-   <strong>purpose</strong>: Leave a PubSub channel.
