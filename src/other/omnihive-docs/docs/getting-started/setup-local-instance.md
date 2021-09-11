---
title: Setup a local instance
---

:::note Why Set up your own local instance?

In order to do any custom function development it is recommended that you setup you're own local instance of OmniHive for testing and debugging.
This is not a requirement but from our experience it massively increases efficiency and provides a much more enjoyable development experience.
:::

## Setup the Repo

In order to setup a local instance for development you will need a running version of the OmniHive repo. The first step to this is to fork the repo from GitHub <a target="_blank" href="https://github.com/WithOneVisionTechnologies/omnihive">here</a>.

:::caution
If you are interested or think you might be interested in submitting pull requests to OmniHive in the future it is important to create a branch
now that contains no custom workers or configurations. This will make submitting pull requests to OmniHive a lot easier in the future.
:::

## Setup a base configuration

You will need to setup a base configuration before you can run your new local instance. To create a configuration file create a settings folder in
the main repo. Then create a file named "omnihive_dev_config.json".

### Blank local config.json

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
    "workers": []
}
```

### Configuring local workers

When configuring a new worker you are developing you will leave the package and version as empty strings ("").
The importPath will then need to be the absolute or relative path (to the main omnihive package) to the local worker.
i.e. "../../../src/custom/custom-omnihive-worker/graph/new-graph-endpoint".

#### Example local worker config object

```json title="Local Worker Config Object"
{
    "name": "<Worker Name>",
    "type": "<Worker Type>",
    "package": "",
    "version": "",
    "importPath": "../../../src/custom/<worker package name>/graph/<graphEndpointWorker name>",
    "default": false,
    "enabled": true,
    "metadata": {
        "customProperty1": "customValue1",
        "customProperty2": "customValue2"
    }
},
```

### Visual Studio Code Extension

You can download the VS Code extension to help maintain and modify you're OmniHive instances (including your local instance). You can find it by searching "OmniHive Server Manager" in the Extensions Marketplace.
To connect to your local OmniHive instance you will need to click the green "+" button in the top right corner of your OmniHive Server Manager panel. You will then enter the following data:

-   <strong>Server Label</strong>: (Developer's choice)
-   <strong>Server IP or Web Address</strong>: ws://localhost
-   <strong>Admin Port Number</strong>: (adminPortNumber specified in your configuration file)
-   <strong>Admin Password</strong>: (adminPassword specified in your configuration file)

If you want more details about the features of the VS Code Extension then click [here](./vscode-extension).

## Start up your new OmniHive Server

Now that you have all of your configuration set all you need to do is run `pnpm server:debug` from a console at the root of the project.
