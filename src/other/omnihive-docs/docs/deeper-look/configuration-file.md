---
title: Configuration File
---

## Config Walkthrough

The settings file contains 4 subobjects that each hold important information regarding how your instance of omnihive runs. The config object contains all of the initial connection settings.
The constants object contains any data you want to reference in any area of your local instance (including your custom workers). The features object contains helpful booleans for turning
omnihive features on and off. The workers object contains all of the workers you want omnihive to boot up.

### Config Object

The config object contains 4 properties. adminPassword, adminPortNumber, webRootUrl, and nodePortNumber.

-   The adminPassword is the string you will use to connect to your OmniHive instance from other applications (if the worker requires it).
-   The adminPortNumber is the port number where the admin commands will be running.
-   The webRootUrl is the root url of all of the OmniHive APIs that will be available to you. So if any custom graphQL or REST workers are created the url would start
    with webRootUrl/(serverRoute)/custom/(graphql or rest/api-docs).
-   The nodePortNumber is what port the OmniHive service will run on.

### Constants Object

The constants object holds any data you want to be referenced in any area of OmniHive. This includes custom workers, the config file itself, and any provided worker or base file.

### Features Object

The features object holds togglable properties to turn features of OmniHive on and off easily. These features include:

-   <strong>consoleOnlyLogging</strong>: This will skip any logging workers you have declared and only log to the
    console for local debugging.
-   <strong>graphIntrospection</strong>: This will enable GraphiQL and Apollo's introspection features for any GraphQL
    functions or database schemas you have configured.
-   <strong>disableSecurity</strong>: This will disable the requirement to have a JWT token to access database level
    GraphQL requests.
-   <strong>graphPlayground</strong>: This will enable the graph playground for any GraphQL functions or database
    schemas you have configured.
-   <strong>graphTracing</strong>: This will enable GraphiQL and Apollo's tracing features for any GraphQL functions or
    database schemas you have configured.
-   <strong>swagger</strong>: This will enable the swagger api web page for any REST functions you have configured.

### Workers Object

This is the object that will dictate what functionality your OmniHive instance has. Any worker declared here will be available to any other function in OmniHive. They can also be exposed
externally as GraphQL functions, REST functions, or even a Task to be ran by any task manager. These objects are highly customizable. Here is a detailed explaination of what each property
is used for:

-   <strong>name</strong>: The developers name for the worker.
-   <strong>type</strong>: The type of worker this is.
-   <strong>package</strong>: The NPM Package name that contains the worker functionality you wish to add to OmniHive.
-   <strong>version</strong>: The NPM Version of the package you are adding.
-   <strong>importPath</strong>: The import path of the main functionality of the worker you are adding. Including the
    NPM package name.
-   <strong>default</strong>: A boolean to show this worker is a default worker and can be overwritten by another
    package of the same type.
-   <strong>enabled</strong>: A boolean to show that this worker is enabled and will be built with OmniHive.
-   <strong>metadata</strong>: Any data that is required for the worker to run. Such as any api keys, rootUrls,
    authentication data, etc.

:::tip Local Workers
For local workers you will leave the package and version as empty strings (""). The importPath will then need to be the absolute or relative path (to the main omnihive package) to the local worker.
i.e. "../../../src/custom/custom-omnihive-worker/graph/new-graph-endpoint".
:::

### Worker Types

-   <strong>cache</strong>: A server-assisted client side caching worker.
-   <strong>date</strong>: A date worker to assist in date manipulations.
-   <strong>database</strong>: A database worker that will connect to a specified database. This will also dynamically
    generate a full GraphQL schema for the connected database.
-   <strong>dataLifecycleFunction</strong>: A custom function that will intercept any mutation GraphQL call and perform
    the function either before, after, or instead of the written mutation.
-   <strong>encryption</strong>: An encryption worker used to encrypt data going over the wire. Most notibly any custom
    SQL query that is requested.
-   <strong>feature</strong>: A feature flag worker used to dynamically turn features on and off. Perfect for upgrading
    already written code in a custom worker in stages.
-   <strong>fileSystem</strong>: A worker used to access the file system of the machine running OmniHive.
-   <strong>graphBuilder</strong>: A worker that will dynamically build the GraphQL schema of a connected database
    worker.
-   <strong>graphEndpointFunction</strong>: A worker that generates a custom GraphQL endpoint to be called via GraphQL
    to do a specific task.
-   <strong>log</strong>: A worker that will log data to a specified source.
-   <strong>pubSubServer</strong>: A worker that will generate a socket server for applications to connect to for real
    time communication.
-   <strong>pubSubClient</strong>: A worker that connects to a pubSubServer for real time communication.
-   <strong>restEndpointFunction</strong>: A worker that generates a custom REST endpoint to be called via a url to do a
    specific task.
-   <strong>server</strong>: A worker that will be the host of all of the apis generated by OmniHive. The server worker
    also generates an express server that hosts all of the GraphQL and REST endpoints.
-   <strong>taskFunction</strong>: A worker that holds a task function that can be called by any task manager, such as
    VisualCron.
-   <strong>unknown</strong>: Any miscellaneous worker type that has no match here.
-   <strong>Any User Defined Type</strong>: You as the developer can define any worker type you desire here. This string
    will have to match exactly if you try to access the type of worker via another worker via the `GetWorker` command.

## Example config.json

```json title="./settings/omnihive_dev_config.json"
{
    "config": {
        "adminPassword": "<Desired Password>",
        "adminPortNumber": 7207,
        "webRootUrl": "http://localhost:3003",
        "nodePortNumber": 3003
    },
    "constants": {
        "ohEncryptionKey": "<16, 24, or 32 bit encryption key>",
        "ohTokenAudience": "<JWT audience string>",
        "ohTokenSecret": "<JWT secret>",
        "ohTokenExpiresIn": "30m",
        "ohTokenHashAlgorithm": "sha1"
    },
    "features": {
        "consoleOnlyLogging": true,
        "graphIntrospection": true,
        "disableSecurity": false,
        "graphPlayground": true,
        "graphTracing": false,
        "swagger": true
    },
    "workers": [
        {
            "name": "<Worker Name>",
            "type": "<Worker Type>",
            "package": "<NPM Package Name>",
            "version": "<desired NPM version or workspace:* if you wish to use the local version>",
            "importPath": "<Import path of function including package name>",
            "default": false,
            "enabled": true,
            "metadata": {
                "customProperty1": "customValue1",
                "customProperty2": "customValue2"
            }
        },
        {
            "name": "working example - tokenWorker",
            "type": "token",
            "package": "@withonevision/omnihive-worker-token-jsonwebtoken",
            "version": "workspace:*",
            "importPath": "@withonevision/omnihive-worker-token-jsonwebtoken/index",
            "default": false,
            "enabled": true,
            "metadata": {
                "audience": "${ohTokenAudience}",
                "tokenSecret": "${ohTokenSecret}",
                "verifyOn": true,
                "expiresIn": "30m",
                "hashAlgorithm": "sha1"
            }
        }
    ]
}
```
