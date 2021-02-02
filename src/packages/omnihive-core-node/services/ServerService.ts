import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { OmniHiveLogLevel } from "@withonevision/omnihive-core/enums/OmniHiveLogLevel";
import { ServerStatus } from "@withonevision/omnihive-core/enums/ServerStatus";
import { CoreServiceFactory } from "@withonevision/omnihive-core/factories/CoreServiceFactory";
import { ObjectHelper } from "@withonevision/omnihive-core/helpers/ObjectHelper";
import { StringBuilder } from "@withonevision/omnihive-core/helpers/StringBuilder";
import { IFeatureWorker } from "@withonevision/omnihive-core/interfaces/IFeatureWorker";
import { IFileSystemWorker } from "@withonevision/omnihive-core/interfaces/IFileSystemWorker";
import { IHiveAccountWorker } from "@withonevision/omnihive-core/interfaces/IHiveAccountWorker";
import { ILogWorker } from "@withonevision/omnihive-core/interfaces/ILogWorker";
import { IRestEndpointWorker } from "@withonevision/omnihive-core/interfaces/IRestEndpointWorker";
import { HiveWorker } from "@withonevision/omnihive-core/models/HiveWorker";
import { HiveWorkerMetadataRestFunction } from "@withonevision/omnihive-core/models/HiveWorkerMetadataRestFunction";
import { OmniHiveConstants } from "@withonevision/omnihive-core/models/OmniHiveConstants";
import { ServerSettings } from "@withonevision/omnihive-core/models/ServerSettings";
import bodyParser from "body-parser";
import childProcess from "child_process";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import http, { Server } from "http";
import next from "next";
import readPkgUp from "read-pkg-up";
import { serializeError } from "serialize-error";
import swaggerUi from "swagger-ui-express";
import { parse } from "url";
import NextServer from "next/dist/next-server/server/next-server";

export class ServerService {
    private static singleton: ServerService;

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    private constructor() {}

    public static getSingleton = (): ServerService => {
        if (!ServerService.singleton) {
            ServerService.singleton = new ServerService();
        }

        return ServerService.singleton;
    };

    public adminServer: NextServer | undefined = undefined;
    public adminServerPreparing: boolean = false;
    public appServer!: express.Express;
    public serverStatus: ServerStatus = ServerStatus.Unknown;
    public serverError: any = {};
    public webServer: Server | undefined = undefined;

    public changeServerStatus = (serverStatus: ServerStatus, error?: Error): void => {
        this.serverStatus = serverStatus;

        if (error) {
            this.serverError = serializeError(error);
        } else {
            this.serverError = {};
        }
    };

    public initServer = async (
        packageJson: readPkgUp.NormalizedReadResult | undefined,
        serverSettings: ServerSettings
    ) => {
        // Load Core Workers
        if (
            packageJson &&
            packageJson.packageJson &&
            packageJson.packageJson.omniHive &&
            packageJson.packageJson.omniHive.coreWorkers
        ) {
            const coreWorkers: HiveWorker[] = packageJson.packageJson.omniHive.coreWorkers as HiveWorker[];

            for (const coreWorker of coreWorkers) {
                await CoreServiceFactory.workerService.pushWorker(coreWorker);
                CoreServiceFactory.configurationService.settings.workers.push(coreWorker);
            }
        }

        const logWorker: ILogWorker | undefined = await CoreServiceFactory.workerService.getWorker<ILogWorker>(
            HiveWorkerType.Log,
            "ohreqLogWorker"
        );

        if (!logWorker) {
            throw new Error("Core Log Worker Not Found.  App worker needs the core log worker ohreqLogWorker");
        }

        const fileSystemWorker:
            | IFileSystemWorker
            | undefined = await CoreServiceFactory.workerService.getWorker<IFileSystemWorker>(
            HiveWorkerType.FileSystem,
            "ohreqFileSystemWorker"
        );

        if (!fileSystemWorker) {
            throw new Error(
                "Core FileSystem Worker Not Found.  App worker needs the core log worker ohreqFileSystemWorker"
            );
        }

        // Get Server Settings

        CoreServiceFactory.configurationService.settings = serverSettings;
        logWorker.write(OmniHiveLogLevel.Info, `Server Settings Applied...`);

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
                    !CoreServiceFactory.configurationService.settings.workers.some(
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
                                    CoreServiceFactory.configurationService.settings.constants[metaValue];

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
                        CoreServiceFactory.configurationService.settings.workers.push(defaultWorker);
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

            CoreServiceFactory.configurationService.settings.workers.forEach((hiveWorker: HiveWorker) => {
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
                    cwd: process.cwd(),
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
                    cwd: process.cwd(),
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
        await CoreServiceFactory.workerService.initWorkers(CoreServiceFactory.configurationService.settings.workers);
        logWorker.write(OmniHiveLogLevel.Info, "Hive Workers Initiated...");

        // Get account if hive worker exists
        if (
            CoreServiceFactory.workerService.registeredWorkers.some(
                (hiveWorker: [HiveWorker, any]) => hiveWorker[0].type === HiveWorkerType.HiveAccount
            )
        ) {
            const accoutWorker: [HiveWorker, any] | undefined = CoreServiceFactory.workerService.registeredWorkers.find(
                (hiveWorker: [HiveWorker, any]) => hiveWorker[0].type === HiveWorkerType.HiveAccount
            );

            if (accoutWorker) {
                const accountWorkerInstance: IHiveAccountWorker = accoutWorker[1] as IHiveAccountWorker;
                CoreServiceFactory.configurationService.account = await accountWorkerInstance.getHiveAccount();
            }
        }
    };

    public getCleanAppServer = async (): Promise<express.Express> => {
        const logWorker: ILogWorker | undefined = await CoreServiceFactory.workerService.getWorker<ILogWorker>(
            HiveWorkerType.Log,
            "ohreqLogWorker"
        );

        const featureWorker:
            | IFeatureWorker
            | undefined = await CoreServiceFactory.workerService.getWorker<IFeatureWorker>(HiveWorkerType.Feature);

        const webAdmin: boolean | undefined = await featureWorker?.get<boolean>("webAdmin", true);
        const nextJsDevMode: boolean | undefined = await featureWorker?.get<boolean>("nextJsDevMode", false);

        // Build app

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

        // Register admin

        if (webAdmin ?? true) {
            if (!this.adminServer && this.adminServerPreparing === false) {
                this.adminServerPreparing = true;

                const nextApp = next({ dev: nextJsDevMode ?? false });
                nextApp.prepare().then(() => {
                    this.adminServer = nextApp;
                    this.adminServerPreparing = false;
                });
            }

            const nextHandler = this.adminServer?.getRequestHandler();

            app.get("/admin", (req, res) => {
                if (nextHandler) {
                    if (!this.adminServer) {
                        res.setHeader("Content-Type", "application/json");
                        return res.status(200).json({ adminStatus: "loading" });
                    }

                    const parsedUrl = parse(req.url, true);
                    return nextHandler(req, res, parsedUrl);
                }

                return res.status(404);
            });

            app.get("/admin/*", (req, res) => {
                if (nextHandler) {
                    if (!this.adminServer) {
                        res.setHeader("Content-Type", "application/json");
                        return res.status(200).json({ adminStatus: "loading" });
                    }

                    const parsedUrl = parse(req.url, true);
                    return nextHandler(req, res, parsedUrl);
                }

                return res.status(404);
            });
        }

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
                    url: `${CoreServiceFactory.configurationService.settings.config.rootUrl}${OmniHiveConstants.SYSTEM_REST_ROOT}`,
                },
            ],
            paths: {},
            definitions: {},
        };

        CoreServiceFactory.workerService.registeredWorkers
            .filter(
                (w: [HiveWorker, any]) => w[0].type === HiveWorkerType.RestEndpointFunction && w[0].enabled === true
            )
            .forEach((w: [HiveWorker, any]) => {
                let workerMetaData: HiveWorkerMetadataRestFunction;

                try {
                    workerMetaData = ObjectHelper.createStrict<HiveWorkerMetadataRestFunction>(
                        HiveWorkerMetadataRestFunction,
                        w[0].metadata
                    );
                } catch (e) {
                    logWorker?.write(
                        OmniHiveLogLevel.Error,
                        `Cannot register system REST worker ${w[0].name}.  MetaData is incorrect.`
                    );

                    return;
                }

                if (!workerMetaData.isSystem) {
                    return;
                }

                const workerInstance: IRestEndpointWorker = w[1] as IRestEndpointWorker;

                app[workerMetaData.restMethod](
                    `${OmniHiveConstants.SYSTEM_REST_ROOT}${workerMetaData.methodUrl}`,
                    async (req: express.Request, res: express.Response) => {
                        res.setHeader("Content-Type", "application/json");

                        try {
                            const workerResponse: [{} | undefined, number] = await workerInstance.execute(
                                req.headers,
                                `${req.protocol}://${req.get("host")}${req.originalUrl}`,
                                req.body
                            );

                            if (workerResponse[0]) {
                                res.status(workerResponse[1]).json(w[0]);
                            } else {
                                res.status(workerResponse[1]).send(true);
                            }
                        } catch (e) {
                            res.status(500).json(serializeError(e));
                        }
                    }
                );

                const workerSwagger: swaggerUi.JsonObject | undefined = workerInstance.getSwaggerDefinition();

                if (workerSwagger) {
                    swaggerDefinition.paths = { ...swaggerDefinition.paths, ...workerSwagger.paths };
                    swaggerDefinition.definitions = {
                        ...swaggerDefinition.definitions,
                        ...workerSwagger.definitions,
                    };
                }
            });

        app.use(`${OmniHiveConstants.SYSTEM_REST_ROOT}/api-docs`, swaggerUi.serve, swaggerUi.setup(swaggerDefinition));

        return app;
    };

    public getRootUrlPathName = (): string => {
        const rootUrl: URL = new URL(CoreServiceFactory.configurationService.settings.config.rootUrl);
        return rootUrl.pathname;
    };

    public loadSpecialStatusApp = async (status: ServerStatus, error?: Error): Promise<void> => {
        if (this.serverStatus === ServerStatus.Admin || this.serverStatus === ServerStatus.Rebuilding) {
            return;
        }

        this.serverStatus = status;
        this.serverError = error;

        const app: express.Express = await this.getCleanAppServer();

        app.get("/", (_req, res) => {
            res.setHeader("Content-Type", "application/json");
            return res.status(200).json({ status: this.serverStatus, error: this.serverError });
        });

        this.appServer = app;
    };

    public serverChangeHandler = async (): Promise<void> => {
        const logWorker: ILogWorker | undefined = await CoreServiceFactory.workerService.getWorker<ILogWorker>(
            HiveWorkerType.Log,
            "ohreqLogWorker"
        );

        if (!logWorker) {
            throw new Error("Core Log Worker Not Found.  Server needs the core log worker ohreqLogWorker");
        }

        logWorker.write(OmniHiveLogLevel.Info, `Server Change Handler Started`);

        const server: Server = http.createServer(this.appServer);
        this.webServer?.removeAllListeners().close();
        this.webServer = server;

        this.webServer?.listen(CoreServiceFactory.configurationService.settings.config.portNumber, () => {
            logWorker.write(
                OmniHiveLogLevel.Info,
                `New Server Listening on process ${process.pid} using port ${CoreServiceFactory.configurationService.settings.config.portNumber}`
            );
        });

        logWorker.write(OmniHiveLogLevel.Info, `Server Change Handler Completed`);
    };
}
