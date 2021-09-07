---
title: Building Custom Workers
---

OmniHive gives developers the ability to create and override any worker with whatever worker they want.
This gives developers great flexibility to create whatever they need to impliment it quickly.

## Building a worker

To start building a worker it is best if you create a local instance of OmniHive so you can test while you develop the worker.
You can see how to make a local instance [here](./setup-local-instance).

:::caution
If you wish to ever make a pull request to the main OmniHive repo you will want to create a branch with no custom workers
defined. This will make creating pull requests easier in the future and remove the step of removing any custom workers
from your instance.
:::

After you get your local instance setup you can create a folder inside of the custom folder under source (`./src/custom`).
Once your worker's folder is created you can begin coding your new worker. The files that you need to have in your folder are as follows:

-   package.json
-   tsconfig.json (if you are using typescript)

#### Example package.json

```json title="Custom Worker package.json"
{
    "name": "<NPM name for your custom worker>",
    "version": "0.0.1",
    "description": "<Description of your custom worker>",
    "license": "MIT",
    "author": {
        <Author information>
    },
    "repository": {
        <Repository information>
    },
    "publishConfig": {
        "access": "public"
    },
    "keywords": [
        "OmniHive",
        <Any additional keywords desired>
    ],
    "scripts": {
        "build": "tsc"
    },
    "dependencies": {
        "@withonevision/omnihive-core": "workspace:*", (To use the local package's core)
        "serialize-error": "8.0.1" (Better error console logs)
        <Any other needed packages should be added here>
    },
    "devDependencies": {
        "chai": "4.3.4", (For automated testing)
        "typescript": "4.2.3" (If you wish to use typescript)
    }
}
```

#### Example tsconfig.json

```json title="Custom Worker tsconfig.json"
{
    "extends": "../../../tsconfig.json",
    "compilerOptions": {
        "outDir": "../../../dist/custom/<created folder name>",
        "rootDir": "."
    },
    "paths": {
        "@withonevision/*": ["../../packages/*"]
    },
    "include": ["./**/*.ts", "./**/*.tsx"],
    "exclude": ["./tests/**/*"]
}
```

## Build the worker's logic

At this point you can code whatever you need inside of any structure you wish. You can either make the worker
a stand along one file worker by adding a index.ts file or have a multiworker package so you create workers based one
paths inside of the configuration.

### Worker logic

If creating a custom worker of a predefined type (found [here](../deeper-look/configuration-file#worker-types)) then you have to
follow the interfaces pre-defined structure. All pre-defined interfaces can be found in `./src/packages/omnihive-core/interfaces`.

:::note Custom Worker types
You can also create your own interfaces if you wish to have controlled worker types for any functionality that defaults do not currently exist for.
:::

#### Graph Endpoint Typescript Example

```ts title="graphEndpointWorker"
import { IGraphEndpointWorker } from "@withonevision/omnihive-core/interfaces/IGraphEndpointWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-core/models/HiveWorkerBase";
import { serializeError } from "serialize-error";

export default class CustomGraphEndpointWorker extends HiveWorkerBase implements IGraphEndpointWorker {
    public execute = async (customArgs: any): Promise<any> => {
        try {
            // desired logic here
        } catch (err) {
            console.log(JSON.stringify(serializeError(err)));
            return err;
        }
    };
}
```

## Configure custom worker

You can now use the VS Code Extension to add the configuration of your new custom worker (shown [here](./vscode-extension#server-workers)). If you wish to manually add the configuration
to your local configuration file or use the raw editor there are two examples for both a single worker package and a multiworker package below.

#### Example custom worker configuration objects

```json title="Single Worker package"
{
    "name": "<Worker Name>",
    "type": "<Worker Type>",
    "package": "",
    "version": "",
    "importPath": "../../../src/custom/<worker package name>",
    "default": false,
    "enabled": true,
    "metadata": {
        "customProperty1": "customValue1",
        "customProperty2": "customValue2"
    }
},
```

```json title="Multipackage Worker package"
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
