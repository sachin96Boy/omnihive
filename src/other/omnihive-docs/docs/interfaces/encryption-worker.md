---
title: Encryption Worker
---

### Interface Name: IEncryptionWorker

## Required Functions:

### base64Encode

-   <strong>arguments</strong>: (toEncode: string)
-   <strong>returns</strong>: string
-   <strong>purpose</strong>: Encode the provided string using base64 encoding.

### base64Decode

-   <strong>arguments</strong>: (toDecode: string)
-   <strong>returns</strong>: string
-   <strong>purpose</strong>: Decode the provided base64 encoded string.

### symmetricDecrypt

-   <strong>arguments</strong>: (message: string)
-   <strong>returns</strong>: string
-   <strong>purpose</strong>: Encode the provided string using symmetric encoding.

### symmetricEncrypt

-   <strong>arguments</strong>: (message: string)
-   <strong>returns</strong>: string
-   <strong>purpose</strong>: Decode the provided symmetric encoded string.
