---
title: Visual Studio Code Extension
---

The VS Code Extension is the main OmniHive instance management tool used for developers and by developers.
The Extension gives developers the ability to:

-   Run custom GraphQL queries
-   Test GraphQL database calls
-   Run REST endpoints
-   Manage OmniHive instance's configurations
-   View the OmniHive instance's live logs
-   Refresh the OmniHive instance's schema to pull in any changes
-   Retrieve an authorization Token to access protected functions of OmniHive

## Server List details

The OmniHive management panel shows the list of servers you are currently connected to. The color dot at the bottom right of the bee
shows the current status of the server.

-   <strong>Green</strong>: The instance is running normally.
-   <strong>Yellow</strong>: The instance is currently building.
-   <strong>Orange</strong>: Something went wrong when building and the instance is now in Admin mode. Only allowing
    configuration changes.
-   <strong>Red</strong>: The instance is not connected.

## Browsers

The browsers folder contains all of the groups of endpoints registered to the given OmniHive instance.
This could include custom REST functions, database GraphQL sets, as well as GraphQL custom function sets.

<br />

The REST functions are grouped by Swagger. This gives the developer the ability to run the custom REST endpoints
they coded for testing and demonstration purposes.

<br />

The GraphQL sets use the GraphiQL playground to give the developer the ability to test GraphQL strings and verify
the results.

## Configuration

The Configuration folder gives the developer the ability to modify and maintain the OmniHive instances configuration without
knowing the ins and outs of the entire structure. If you wish to know more about the configuration structure itself
it can be found [here](../deeper-look/configuration-file).

### Server Configuration

The Server Configuration page manages the main configuration of the OmniHive instance. This page controls things such as the root URLs as well
as what port the processes are running on. More details can be found [here](../deeper-look/configuration-file#config-object).

### Server Constants

The Server Constants contain a list of values (string, number, or boolean) that can be used throughout the OmniHive instance. This includes
any worker as well as inside the configuration itself. This is a good place for the developer to add any information they will need for development
purposes. Such as encryption keys, shared api-keys, etc. More details can be found [here](../deeper-look/configuration-file#constants-object).

### Server Features

The Server Features contains a list of available OmniHive features that be turned on or off for this OmniHive instance. More details
can be found [here](../deeper-look/configuration-file#features-object).

### Server Workers

The Server Workers is what dictates what functionality this OmniHive instance has. If there are no workers listed then only the basic
default functionality will be available. To add workers simply click the the three dots next to the add button and select worker.
Fill in the required information for either a local worker or NPM package that contains a worker. More details can be found
[here](../deeper-look/configuration-file#workers-object).

:::tip Local Workers
For local workers you will leave the package and version as empty strings (""). The importPath will then need to be the absolute or relative path (to the main omnihive package) to the local worker.
i.e. "../../../src/custom/custom-omnihive-worker/graph/new-graph-endpoint".
:::

### Raw Configuration Editor

The Raw Configuration Editor gives the developer the ability to edit the configuration in its full JSON object. There is a log to let you know
if the configuration you have is valid or not shown on the right side of the screen.

:::danger
Only use the raw editor if you are aware of the structure and what is expected from the properties you are editing. If you need more information
please review the [doc on the configuration file](../deeper-look/configuration-file).
:::

## Tools

The Tools folder gives the developer the ability to live view logs of messages happening on the OmniHive instance, refresh schema so the instance can
pick up any changes made, and get new authorization tokens.

### Log Viewer

This is a live log of events that are happening on the OmniHive instance. If you put a `console.log` in any worker then it will appear in this log.

:::info Historical logs
This view will not show historical logs. Only logs that are happening while you are on the page.
:::

### Refresh schema

This button will trigger a schema refresh on the OmniHive instance. Depending on your VS Code settings the Log Viewer might be shown when the refresh is
triggered so you can monitor its progress in real time.

### Retrieve Token

This will generate a new authorization token provided by your declared token worker.

## Server Panel functions

### Adding Server Connection

To add a server to your extension hover over the "Servers" line and click the green plus button. This will take you to a Add Server page.
You will need to set your server up to handle websocket connections. The following values will need to be populated:

-   <strong>Label</strong>: The name you want to reference the server by.
-   <strong>Server IP or Web Address</strong>: The wss or ws url of the websocket to the server you want to connect to.
-   <strong>Admin Port Number</strong>: Not needed for websocket connections.
-   <strong>Admin Password</strong>: The OmniHive password that is found in the OmniHive instance's config file.

### Editing Server Connections

To edit the server connection you will need to hover over the server label of the connection you wish to edit then click the pencil button.
This will take you to the same screen as the Add Server connection step. Modify what is needed.

### Delete Server Connection

To delete a server connection hover over the label of the server you wish to delete. You will be presented with a confirmation dialog box.
Once confirmed the connection will be removed.

### Delete all server connections

Hover over the main server label at the top of the panel. Then click the trash can icon with the red x in it. You will be presented with a
confirmation dialog box. Once confirmed all connections will be removed.

### Connect to Server - Disconnected State Only

When the server is showing a red icon it means that it is not currently connected to the server. A plug icon will be shown when you hover over
the server's label. When this button is pressed it will attempt to reconnect to the server.

### Refresh Schema - Admin Mode Only

When the server had an error starting up then you will see an orange icon for the server. When this happens you will be given another way to
refresh the OmniHive instances schema by hovering over the server's label. You will see a refresh symbol. When you press this icon it will
trigger a schema refresh just like the refresh in the tools folder.

### View Logs - Admin Mode Only

When the server had an error starting up then you will see an orange icon for the server. When this happens you will be given another way to
view the live log of the OmniHive instances by hovering over the server's label. You will see a search (magnifying glass) symbol. When you press this icon it will
open the live log viewer just like the log viewer button in the tools folder.
