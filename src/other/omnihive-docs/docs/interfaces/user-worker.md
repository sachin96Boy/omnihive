---
title: User Worker
---

### Interface Name: IUserWorker

## Required Functions:

### create

-   <strong>arguments</strong>: (email: string, password: string)
-   <strong>returns</strong>: Promise&lt;<a href="../models/auth-user">AuthUser</a>&gt;
-   <strong>purpose</strong>: Create a user.

### get

-   <strong>arguments</strong>: (email: string)
-   <strong>returns</strong>: Promise&lt;<a href="../models/auth-user">AuthUser</a>&gt;
-   <strong>purpose</strong>: Retrieve the user.

### login

-   <strong>arguments</strong>: (email: string, password: string)
-   <strong>returns</strong>: Promise&lt;<a href="../models/auth-user">AuthUser</a>&gt;
-   <strong>purpose</strong>: Log the user into the system.

### passwordChangeRequest

-   <strong>arguments</strong>: (email: string)
-   <strong>returns</strong>: Promise&lt;boolean&gt;
-   <strong>purpose</strong>: Request a change password email.

### update

-   <strong>arguments</strong>: (userName: string, authUser: <a href="../models/auth-user">AuthUser</a>)
-   <strong>returns</strong>: Promise&lt;<a href="../models/auth-user">AuthUser</a>&gt;
-   <strong>purpose</strong>: Update a user with the provided data.

### getUserIdByEmail

-   <strong>arguments</strong>: (email: string)
-   <strong>returns</strong>: Promise&lt;string | undefined&gt;
-   <strong>purpose</strong>: Retrieve the userId from the provided email.

### delete

-   <strong>arguments</strong>: (id: string)
-   <strong>returns</strong>: Promise&lt;string&gt;
-   <strong>purpose</strong>: Delete the user.
