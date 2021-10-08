---
title: Token Worker
---

### Interface Name: ITokenWorker

## Required Functions:

### get

-   <strong>arguments</strong>: none
-   <strong>returns</strong>: Promise&lt;string&gt;
-   <strong>purpose</strong>: Get the Access Token

### expired

-   <strong>arguments</strong>: (token: string)
-   <strong>returns</strong>: Promise&lt;boolean&gt;
-   <strong>purpose</strong>: Determine if the provided token is expired.

### verify

-   <strong>arguments</strong>: (token: string)
-   <strong>returns</strong>: Promise&lt;boolean&gt;
-   <strong>purpose</strong>: Determine if the provided token is valid.
