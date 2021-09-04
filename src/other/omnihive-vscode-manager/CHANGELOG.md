# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### 6.1.4 (2021-07-30)


### Code Maitenance

* **vscode-extension:** cleanup readme ([7efdbd9](https://github.com/WithOneVisionTechnologies/omnihive-manager-vs-code/commit/7efdbd91c17257082a3c6971df4a27426abee65d))

### 6.1.3 (2021-07-30)


### Code Maintenance

* **vscode-extension:** color palette and icons ([a7487e4](https://github.com/WithOneVisionTechnologies/omnihive-manager-vs-code/commit/a7487e492aa434de1c27464657309e76ab13e5fb))

### 6.1.2 (2021-07-22)


### Code Maitenance

* **vscode-extension:** update to latest OH core ([28d4806](https://github.com/WithOneVisionTechnologies/omnihive-manager-vs-code/commit/28d4806a88a4964923792b3807e6ebf2a3beaf7f))

### 6.1.1 (2021-07-21)


### Bug Fixes

* **vscode-extension:** multiple bugfixes ([389c522](https://github.com/WithOneVisionTechnologies/omnihive-manager-vs-code/commit/389c522db42921ccc59b2bcca8fbda26a82a725b)), closes [#20](https://github.com/WithOneVisionTechnologies/omnihive-manager-vs-code/issues/20) [#19](https://github.com/WithOneVisionTechnologies/omnihive-manager-vs-code/issues/19) [#18](https://github.com/WithOneVisionTechnologies/omnihive-manager-vs-code/issues/18) [#17](https://github.com/WithOneVisionTechnologies/omnihive-manager-vs-code/issues/17) [#16](https://github.com/WithOneVisionTechnologies/omnihive-manager-vs-code/issues/16)

## 6.1.0 (2021-07-02)


### Features

* **vscode-extension:** :sparkles: update to latest ohv6 ([80d343d](https://github.com/WithOneVisionTechnologies/omnihive-manager-vs-code/commit/80d343d0617d9d33003d16bc3781ded019d17267))

### 6.0.6 (2021-06-15)


### Bug Fixes

* **vscode-extension:** :bug: saving with system env variables ([6c174a0](https://github.com/WithOneVisionTechnologies/omnihive-manager-vs-code/commit/6c174a0fa7152d6b570d78d85919e42c0a6ed7e0))

### 6.0.5 (2021-06-12)


### Code Maintenance

* **vscode-extension:** move to fontawesome free ([b81f812](https://github.com/WithOneVisionTechnologies/omnihive-manager-vs-code/commit/b81f81230659637fe0f6fc9a6ae0d34812d285c7))

### 6.0.4 (2021-06-10)


### Bug Fixes

* **vscode-extension:** :bug: socket reconnect not reading ([f3bab28](https://github.com/WithOneVisionTechnologies/omnihive-manager-vs-code/commit/f3bab28ec6d89f8077e19e7418dc99f5b29df451))

### 6.0.3 (2021-05-29)


### Build

* **vscode-extension:** :hammer: GHA cleanup ([8fd03d2](https://github.com/WithOneVisionTechnologies/omnihive-manager-vs-code/commit/8fd03d227b2552caa9740274f846af3e4ed397f4))

### 6.0.2 (2021-05-29)


### Build

* **vscode-extension:** :hammer: reorder GHA action ([cc93f7a](https://github.com/WithOneVisionTechnologies/omnihive-manager-vs-code/commit/cc93f7a53bcf993f6cbf43750cd3eba31b13e179))

## 6.0.1

-   Build script only

## 6.0.0

-   Skip v5 to go to v6 to sync up with server version.
-   New connectivity in the background (Socket.IO).
-   Connectivity fixes for all the React-based screens.
-   Plugin is now cluster-aware (based on server v 6.x and above).
-   Added option to select between YAML and JSON as editor.
-   Icons updated to be more standardized across the board.
-   Various fixes for UI experience where disconnects would bork the screen you were currently on.
-   Removed capacity to edit raw server configs. That has been moved to the server boot loader and can no longer be hot-edited as it can collapse the server.

## 4.1.2

-   Finish cleaning up icons so they will work with the bug of VS Code in April 2021. Has been fixed in insiders.
-   Taking out default documentation in GraphQL browser since all you ever do is delete it first.

## 4.1.1

-   Fix for broken icons in April 2021 release of VS Code

## 4.1.0

-   Fixed several timeout issues on React webview socket handling
-   Fixed mouseleave handlers triggering too many notifications for user on settings changes
-   Fixed several saving issues with configuration
-   Implemented font awesome for icon handling in React instead of manual SVGs.
-   Added capacity to manually set in extension settings whether log window opened automatically on settings save
-   Added capacity to manually set in extension settings whether settings windows closed automatically on settings save
-   Impemented heartbeat monitoring on ws connections
-   Fixed favicon on webviews
-   Requires OH server version >= 5.1.0

## 4.0.9

-   Respect custom headers in graph playground

## 4.0.8

-   Adding persistence to all instances of GraphiQL headers

## 4.0.7

-   Adding persistence to GraphiQL headers

## 4.0.6

-   Minor change to store handling

## 4.0.5

-   Fixed some bad error handling with WebSockets when registering servers.

## 4.0.4

-   Fixed issue with registering server showing both the success and error notification

## 4.0.3

-   Fixed known connection issues for WS and WSS protocol (particularly with regards to Windows/IIS)

## 4.0.2

-   Bugfixes for registering servers
-   Allowing for editing configuration in administrative mode

## 4.0.1

-   Bugfix for modal editors not correctly saving boolean values
-   Bugfix for raw editor not validating import path correctly
-   Bugfix for not showing graph custom function browser URL

## 4.0.0

-   Completely refactored from the extension "OmniHive" and re-published under a different name for backwards compatibility
-   Ground-up redesign to be more like a "database IDE"

## 2.0.8

-   Updated all packages
-   Upgraded to TS 4.0 with corresponding ESLint
-   Removed a number of unnecessary packages
-   Cleaned up all import structure
-   Updated to 3.x line of OH clients
-   Added ability to manage NPM packages for the account directly in the plugin

## 2.0.7

-   Fixed OmniHive client to not error out on getting new stores multiple times
-   Fixed RegEx parser for function upload
-   Fixed error where untitled window which had not been saved would not upload function.
-   Moved from TSLint to ESLint since TSLint is deprecated.

## 2.0.5

-   Fixed OmniHive client to be multi-tenant under the hood
-   Separate accounts and servers now stay separate instead of populating over one another

## 2.0.4

-   Adding workflow function type

## 2.0.3

-   Revamped to use the new eventing system in the back-end of the OH server.
-   Admin functions added from new server release
-   Tree is now polling to show the status of the servers
-   Logging is available as the servers restart

## 1.1.2

-   Adding sorting of server names, account names, and function uniqueidentifiers

## 1.1.1

-   String sanitizer updates for uploading custom functions.
-   Allowing for uploading custom function without having to first select a server from the sidebar.

## 1.1.0

-   Revamped browser to be server-based first and then account-based.

## 1.0.3

-   First public release
-   All promised functionality implemented

## 1.0.0

-   Added editing server registration.
-   Can now upload functions to the OmniHive server (both new and editing)

## 0.6.1

-   No features added. Updated to latest client to keep up with server changes.

## 0.6.0

-   Added schema refresh command at the server level

-   Functionality left to implement
    -   Full editing of custom functions
    -   Uploading edited and new custom functions

## 0.5.0

-   Initial priview release functions

    -   Can register OmniHive Servers
    -   Can get access tokens for registered servers
    -   Can browse custom functions on registered servers
    -   Can download custom functions on registered servers
    -   All custom function snippets implemented

-   Functionality left to implement
    -   Full editing of custom functions
    -   Uploading edited and new custom functions
    -   Sending schema refresh message to server cluster
