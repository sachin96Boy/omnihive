---
title: Config Worker
---

### Interface Name: IConfigWorker

## Required Functions:

### get

-   <strong>arguments</strong>: none
-   <strong>returns</strong>: Promise&lt;<a href="../models/server-settings">ServerSettings</a>&gt;
-   <strong>purpose</strong>: Retrieve the Server settings

### set

-   <strong>arguments</strong>: (settings: <a href="../models/server-settings">ServerSettings</a>)
-   <strong>returns</strong>: Promise&lt;boolean&gt;
-   <strong>purpose</strong>: Sets the Server settings
