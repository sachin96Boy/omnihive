---
title: Rest Endpoint Worker
---

### Interface Name: IRestEndpointWorker

## Required Functions:

### getSwaggerDefinition

-   <strong>arguments</strong>: none
-   <strong>returns</strong>: any | undefined
-   <strong>purpose</strong>: Set the swagger definition for the rest endpoint using the JSON variant of swaggerUi.
    Further details can be found <a href="https://swagger.io/specification/" target="_blank">
        here
    </a>

### execute

-   <strong>arguments</strong>: (headers: any, url: string, body: any)
-   <strong>returns</strong>: Promise&lt;
    <a href="../models/rest-endpoint-execute-response">RestEndpointExecuteResponse</a>&gt;
-   <strong>purpose</strong>: Execute the custom code.
