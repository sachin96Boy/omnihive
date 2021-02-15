/// <reference path="../../../types/globals.omnihive.d.ts" />

import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { OmniHiveLogLevel } from "@withonevision/omnihive-core/enums/OmniHiveLogLevel";
import { RegisteredUrlType } from "@withonevision/omnihive-core/enums/RegisteredUrlType";
import { ServerStatus } from "@withonevision/omnihive-core/enums/ServerStatus";
import { ObjectHelper } from "@withonevision/omnihive-core/helpers/ObjectHelper";
import { StringBuilder } from "@withonevision/omnihive-core/helpers/StringBuilder";
import { ILogWorker } from "@withonevision/omnihive-core/interfaces/ILogWorker";
import { IRestEndpointWorker } from "@withonevision/omnihive-core/interfaces/IRestEndpointWorker";
import { HiveWorker } from "@withonevision/omnihive-core/models/HiveWorker";
import { HiveWorkerMetadataRestFunction } from "@withonevision/omnihive-core/models/HiveWorkerMetadataRestFunction";
import { RegisteredHiveWorker } from "@withonevision/omnihive-core/models/RegisteredHiveWorker";
import { RestEndpointExecuteResponse } from "@withonevision/omnihive-core/models/RestEndpointExecuteResponse";
import bodyParser from "body-parser";
import childProcess from "child_process";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import http, { Server } from "http";
import path from "path";
import readPkgUp from "read-pkg-up";
import { serializeError } from "serialize-error";
import swaggerUi from "swagger-ui-express";

export class AppService {
    public changeServerStatus = (serverStatus: ServerStatus, error?: Error): void => {
        global.omnihive.serverStatus = serverStatus;

        if (error) {
            global.omnihive.serverError = serializeError(error);
        } else {
            global.omnihive.serverError = {};
        }
    };

    public initCore = async (packageJson: readPkgUp.NormalizedReadResult | undefined) => {
        // Load Core Workers
        if (
            packageJson &&
            packageJson.packageJson &&
            packageJson.packageJson.omniHive &&
            packageJson.packageJson.omniHive.coreWorkers
        ) {
            const coreWorkers: HiveWorker[] = packageJson.packageJson.omniHive.coreWorkers as HiveWorker[];

            for (const coreWorker of coreWorkers) {
                await global.omnihive.pushWorker(coreWorker);
                global.omnihive.serverSettings.workers.push(coreWorker);
            }
        }

        const logWorker: ILogWorker | undefined = global.omnihive.getWorker<ILogWorker>(
            HiveWorkerType.Log,
            "ohreqLogWorker"
        );

        if (!logWorker) {
            throw new Error("Core Log Worker Not Found.  App worker needs the core log worker ohreqLogWorker");
        }

        // Load Workers
        logWorker.write(OmniHiveLogLevel.Info, `Registering default workers from package.json...`);

        // Load Default Workers
        if (
            packageJson &&
            packageJson.packageJson &&
            packageJson.packageJson.omniHive &&
            packageJson.packageJson.omniHive.defaultWorkers
        ) {
            const defaultWorkers: HiveWorker[] = packageJson.packageJson.omniHive.defaultWorkers as HiveWorker[];

            defaultWorkers.forEach((defaultWorker: HiveWorker) => {
                if (
                    !global.omnihive.serverSettings.workers.some(
                        (hiveWorker: HiveWorker) => hiveWorker.type === defaultWorker.type
                    )
                ) {
                    let registerWorker: boolean = true;

                    Object.keys(defaultWorker.metadata).forEach((metaKey: string) => {
                        if (typeof defaultWorker.metadata[metaKey] === "string") {
                            if (
                                (defaultWorker.metadata[metaKey] as string).startsWith("${") &&
                                (defaultWorker.metadata[metaKey] as string).endsWith("}")
                            ) {
                                let metaValue: string = defaultWorker.metadata[metaKey] as string;

                                metaValue = metaValue.substr(2, metaValue.length - 3);
                                const envValue: string | undefined =
                                    global.omnihive.serverSettings.constants[metaValue];

                                if (envValue) {
                                    defaultWorker.metadata[metaKey] = envValue;
                                } else {
                                    registerWorker = false;
                                    logWorker.write(
                                        OmniHiveLogLevel.Warn,
                                        `Cannot register ${defaultWorker.name}...missing ${metaKey} in constants`
                                    );
                                }
                            }
                        }
                    });

                    if (registerWorker) {
                        global.omnihive.serverSettings.workers.push(defaultWorker);
                    }
                }
            });
        }

        logWorker.write(OmniHiveLogLevel.Info, `Working on hive worker packages...`);

        if (
            packageJson &&
            packageJson.packageJson &&
            packageJson.packageJson.dependencies &&
            packageJson.packageJson.omniHive &&
            packageJson.packageJson.omniHive.coreDependencies
        ) {
            // Build lists
            const corePackages: any = packageJson.packageJson.omniHive.coreDependencies;
            const loadedPackages: any = packageJson.packageJson.dependencies;
            const workerPackages: any = {};

            global.omnihive.serverSettings.workers.forEach((hiveWorker: HiveWorker) => {
                if (
                    hiveWorker.package &&
                    hiveWorker.package !== "" &&
                    hiveWorker.version &&
                    hiveWorker.version !== ""
                ) {
                    workerPackages[hiveWorker.package] = hiveWorker.version;
                }
            });

            //Find out what to remove
            const packagesToRemove: string[] = [];

            for (const loadedPackage of Object.entries(loadedPackages)) {
                let removeLoadedPackage: boolean = true;

                for (const corePackage of Object.entries(corePackages)) {
                    if (corePackage[0] === loadedPackage[0] && corePackage[1] === loadedPackage[1]) {
                        removeLoadedPackage = false;
                        break;
                    }
                }

                if (removeLoadedPackage) {
                    for (const workerPackage of Object.entries(workerPackages)) {
                        if (workerPackage[0] === loadedPackage[0] && workerPackage[1] === loadedPackage[1]) {
                            removeLoadedPackage = false;
                            break;
                        }
                    }
                }

                if (removeLoadedPackage) {
                    packagesToRemove.push(loadedPackage[0]);
                }
            }

            if (packagesToRemove.length === 0) {
                logWorker.write(OmniHiveLogLevel.Info, `No Custom Packages to Uninstall...Moving On`);
            } else {
                logWorker.write(OmniHiveLogLevel.Info, `Removing ${packagesToRemove.length} Custom Package(s)`);
                const removeCommand = new StringBuilder();
                removeCommand.append("yarn remove ");

                packagesToRemove.forEach((packageName: string, index: number) => {
                    removeCommand.append(packageName);

                    if (index < packagesToRemove.length - 1) {
                        removeCommand.append(" ");
                    }
                });

                const removeSpawn = childProcess.spawnSync(removeCommand.outputString(), {
                    shell: true,
                    cwd: global.omnihive.ohDirName,
                    stdio: ["inherit", "pipe", "pipe"],
                });

                if (removeSpawn.status !== 0) {
                    const removeError: Error = new Error(removeSpawn.stderr.toString().trim());
                    console.log(removeError);
                    throw removeError;
                }
            }

            //Find out what to add
            const packagesToAdd: string[] = [];

            for (const workerPackage of Object.entries(workerPackages)) {
                let addWorkerPackage: boolean = true;

                for (const loadedPackage of Object.entries(loadedPackages)) {
                    if (workerPackage[0] === loadedPackage[0] && workerPackage[1] === loadedPackage[1]) {
                        addWorkerPackage = false;
                        break;
                    }
                }

                if (addWorkerPackage) {
                    packagesToAdd.push(`${workerPackage[0]}@${workerPackage[1]}`);
                }
            }

            if (packagesToAdd.length === 0) {
                logWorker.write(OmniHiveLogLevel.Info, `No Custom Packages to Add...Moving On`);
            } else {
                logWorker.write(OmniHiveLogLevel.Info, `Adding ${packagesToAdd.length} Custom Package(s)`);
                const addCommand = new StringBuilder();
                addCommand.append("yarn add ");

                packagesToAdd.forEach((packageName: string, index: number) => {
                    addCommand.append(packageName);

                    if (index < packagesToAdd.length - 1) {
                        addCommand.append(" ");
                    }
                });

                const addSpawn = childProcess.spawnSync(addCommand.outputString(), {
                    shell: true,
                    cwd: global.omnihive.ohDirName,
                    stdio: ["inherit", "pipe", "pipe"],
                });

                if (addSpawn.status !== 0) {
                    const addError: Error = new Error(addSpawn.stderr.toString().trim());
                    console.log(addError);
                    throw addError;
                }
            }
        }

        logWorker.write(OmniHiveLogLevel.Info, "Custom packages complete");

        // Register hive workers
        logWorker.write(OmniHiveLogLevel.Info, "Working on hive workers...");
        await global.omnihive.initWorkers(global.omnihive.serverSettings.workers);
        logWorker.write(OmniHiveLogLevel.Info, "Hive Workers Initiated...");
    };

    public getCleanAppServer = async (): Promise<express.Express> => {
        const logWorker: ILogWorker | undefined = global.omnihive.getWorker<ILogWorker>(
            HiveWorkerType.Log,
            "ohreqLogWorker"
        );

        const restRoot: string = `/ohAdmin`;

        // Build app
        global.omnihive.registeredUrls = [];

        const app = express();

        app.use(helmet.dnsPrefetchControl());
        app.use(helmet.expectCt());
        app.use(helmet.frameguard());
        app.use(helmet.hidePoweredBy());
        app.use(helmet.hsts());
        app.use(helmet.ieNoOpen());
        app.use(helmet.noSniff());
        app.use(helmet.permittedCrossDomainPolicies());
        app.use(helmet.referrerPolicy());
        app.use(helmet.xssFilter());

        app.use(bodyParser.urlencoded({ extended: true }));
        app.use(bodyParser.json());
        app.use(cors());

        // Setup Pug
        app.set("view engine", "pug");
        app.set("views", path.join(global.omnihive.ohDirName, `views`));
        app.use("/public", express.static(path.join(global.omnihive.ohDirName, `public`)));

        // Register system REST endpoints

        const swaggerDefinition: swaggerUi.JsonObject = {
            info: {
                title: "OmniHive System Workers REST Interface",
                version: "1.0.0",
                description: "All system REST endpoint workers provided for OmniHive functionality",
            },
            license: {},
            openapi: "3.0.0",
            servers: [
                {
                    url: `${global.omnihive.serverSettings.config.rootUrl}${restRoot}`,
                },
            ],
            paths: {},
            definitions: {},
        };

        global.omnihive.registeredWorkers
            .filter(
                (rw: RegisteredHiveWorker) =>
                    rw.type === HiveWorkerType.RestEndpointFunction && rw.enabled === true && rw.core === true
            )
            .forEach((rw: RegisteredHiveWorker) => {
                let workerMetaData: HiveWorkerMetadataRestFunction;

                try {
                    workerMetaData = ObjectHelper.createStrict<HiveWorkerMetadataRestFunction>(
                        HiveWorkerMetadataRestFunction,
                        rw.metadata
                    );
                } catch (e) {
                    logWorker?.write(
                        OmniHiveLogLevel.Error,
                        `Cannot register system REST worker ${rw.name}.  MetaData is incorrect.`
                    );

                    return;
                }

                const workerInstance: IRestEndpointWorker = rw.instance as IRestEndpointWorker;

                app[workerMetaData.restMethod](
                    `${restRoot}/rest/${workerMetaData.urlRoute}`,
                    async (req: express.Request, res: express.Response) => {
                        res.setHeader("Content-Type", "application/json");

                        try {
                            const workerResponse: RestEndpointExecuteResponse = await workerInstance.execute(
                                req.headers,
                                `${req.protocol}://${req.get("host")}${req.originalUrl}`,
                                req.body
                            );

                            if (workerResponse.response) {
                                res.status(workerResponse.status).json(workerResponse.response);
                            } else {
                                res.status(workerResponse.status).send(true);
                            }
                        } catch (e) {
                            return res.status(500).render("500", {
                                rootUrl: global.omnihive.serverSettings.config.rootUrl,
                                error: serializeError(e),
                            });
                        }
                    }
                );

                global.omnihive.registeredUrls.push({
                    path: `${global.omnihive.serverSettings.config.rootUrl}${restRoot}/rest/${workerMetaData.urlRoute}`,
                    type: RegisteredUrlType.RestFunction,
                });

                const workerSwagger: swaggerUi.JsonObject | undefined = workerInstance.getSwaggerDefinition();

                if (workerSwagger) {
                    swaggerDefinition.paths = { ...swaggerDefinition.paths, ...workerSwagger.paths };
                    swaggerDefinition.definitions = {
                        ...swaggerDefinition.definitions,
                        ...workerSwagger.definitions,
                    };
                }
            });

        app.use(`${restRoot}/api-docs`, swaggerUi.serve, swaggerUi.setup(swaggerDefinition));

        global.omnihive.registeredUrls.push({
            path: `${global.omnihive.serverSettings.config.rootUrl}${restRoot}/api-docs`,
            type: RegisteredUrlType.Swagger,
        });

        return app;
    };

    public getRootUrlPathName = (): string => {
        const rootUrl: URL = new URL(global.omnihive.serverSettings.config.rootUrl);
        return rootUrl.pathname;
    };

    public loadSpecialStatusApp = async (status: ServerStatus, error?: Error): Promise<void> => {
        if (
            global.omnihive.serverStatus === ServerStatus.Admin ||
            global.omnihive.serverStatus === ServerStatus.Rebuilding
        ) {
            return;
        }

        global.omnihive.serverStatus = status;
        global.omnihive.serverError = error;

        const app: express.Express = await this.getCleanAppServer();

        app.get("/", (_req, res) => {
            res.setHeader("Content-Type", "application/json");
            return res.status(200).render("index", {
                rootUrl: global.omnihive.serverSettings.config.rootUrl,
                status: global.omnihive.serverStatus,
                error: global.omnihive.serverError,
            });
        });

        global.omnihive.appServer = app;
    };

    public serverChangeHandler = async (): Promise<void> => {
        const logWorker: ILogWorker | undefined = global.omnihive.getWorker<ILogWorker>(
            HiveWorkerType.Log,
            "ohreqLogWorker"
        );

        if (!logWorker) {
            throw new Error("Core Log Worker Not Found.  Server needs the core log worker ohreqLogWorker");
        }

        logWorker.write(OmniHiveLogLevel.Info, `Server Change Handler Started`);

        const server: Server = http.createServer(global.omnihive.appServer);
        global.omnihive.webServer?.removeAllListeners().close();
        global.omnihive.webServer = server;

        global.omnihive.webServer?.listen(global.omnihive.serverSettings.config.webPortNumber, () => {
            logWorker.write(
                OmniHiveLogLevel.Info,
                `New Server Listening on process ${process.pid} using port ${global.omnihive.serverSettings.config.webPortNumber}`
            );
        });

        logWorker.write(OmniHiveLogLevel.Info, `Server Change Handler Completed`);
    };
}
