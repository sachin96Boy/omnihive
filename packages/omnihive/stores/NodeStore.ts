import { HiveWorkerType } from "@withonevision/omnihive-queen/enums/HiveWorkerType";
import { OmniHiveLogLevel } from "@withonevision/omnihive-queen/enums/OmniHiveLogLevel";
import { ServerStatus } from "@withonevision/omnihive-queen/enums/ServerStatus";
import { StringBuilder } from "@withonevision/omnihive-queen/helpers/StringBuilder";
import { StringHelper } from "@withonevision/omnihive-queen/helpers/StringHelper";
import { IFileSystemWorker } from "@withonevision/omnihive-queen/interfaces/IFileSystemWorker";
import { IHiveAccountWorker } from "@withonevision/omnihive-queen/interfaces/IHiveAccountWorker";
import { ILogWorker } from "@withonevision/omnihive-queen/interfaces/ILogWorker";
import { IRestEndpointWorker } from "@withonevision/omnihive-queen/interfaces/IRestEndpointWorker";
import { HiveWorker } from "@withonevision/omnihive-queen/models/HiveWorker";
import { OmniHiveConstants } from "@withonevision/omnihive-queen/models/OmniHiveConstants";
import { SystemSettings } from "@withonevision/omnihive-queen/models/SystemSettings";
import { QueenStore } from "@withonevision/omnihive-queen/stores/QueenStore";
import bodyParser from "body-parser";
import cors from "cors";
import spawn from "cross-spawn";
import express from "express";
import * as core from "express-serve-static-core";
import helmet from "helmet";
import http, { Server } from "http";
import next from "next";
import NextServer from "next/dist/next-server/server/next-server";
import { NormalizedReadResult } from "read-pkg-up";
import swaggerUi from "swagger-ui-express";
import { parse } from "url";

export class NodeStore {

    private static instance: NodeStore;

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    private constructor() { }

    public static getInstance = (): NodeStore => {
        if (!NodeStore.instance) {
            NodeStore.instance = new NodeStore();
        }

        return NodeStore.instance;
    }

    public static getNew = (): NodeStore => {
        return new NodeStore();
    }

    public adminServer: NextServer | undefined = undefined;
    public adminServerPreparing: boolean = false;
    public appServer!: core.Express;
    public webServer: Server | undefined = undefined;

    public getCleanAppServer = (): core.Express => {

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

        if (!this.adminServer && this.adminServerPreparing === false) {

            this.adminServerPreparing = true;

            const nextApp = next({ dev: QueenStore.getInstance().settings.server.developerMode });
            nextApp.prepare().then(() => {
                this.adminServer = nextApp;
                this.adminServerPreparing = false;
            });
        }

        app.get("/admin", (req, res) => {
            if (!this.adminServer) {
                res.setHeader('Content-Type', 'application/json');
                return res.status(200).json({ adminStatus: "loading" });
            }

            const handle = this.adminServer.getRequestHandler();
            const parsedUrl = parse(req.url, true);
            return handle(req, res, parsedUrl);
        });

        app.get("/admin/*", (req, res) => {
            if (!this.adminServer) {
                res.setHeader('Content-Type', 'application/json');
                return res.status(200).json({ adminStatus: "loading" });
            }

            const handle = this.adminServer.getRequestHandler();
            const parsedUrl = parse(req.url, true);
            return handle(req, res, parsedUrl);
        });

        // Register "built-in" REST endpoints

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
                    url: `${QueenStore.getInstance().settings.server.rootUrl}${OmniHiveConstants.SYSTEM_REST_ROOT}`,
                },
            ],
            paths: {},
            definitions: {}
        };

        const accessTokenWorker = QueenStore.getInstance().workers.find((worker: [HiveWorker, any]) => worker[0].name === "ohreqRestSystemAccessToken");

        if (accessTokenWorker) {
            const accessTokenInstance: IRestEndpointWorker = accessTokenWorker[1] as IRestEndpointWorker;
            accessTokenInstance.register(app, OmniHiveConstants.SYSTEM_REST_ROOT);

            const accessTokenSwagger: swaggerUi.JsonObject | undefined = accessTokenInstance.getSwaggerDefinition();

            if (accessTokenSwagger) {
                swaggerDefinition.paths = { ...swaggerDefinition.paths, ...accessTokenSwagger.paths };
                swaggerDefinition.definitions = { ...swaggerDefinition.definitions, ...accessTokenSwagger.definitions };
            }
        }

        const checkSettingsWorker = QueenStore.getInstance().workers.find((worker: [HiveWorker, any]) => worker[0].name === "ohreqRestSystemCheckSettings");

        if (checkSettingsWorker) {
            const checkSettingInstance: IRestEndpointWorker = checkSettingsWorker[1] as IRestEndpointWorker;
            checkSettingInstance.register(app, OmniHiveConstants.SYSTEM_REST_ROOT);

            const checkSettingsSwagger: swaggerUi.JsonObject | undefined = checkSettingInstance.getSwaggerDefinition();

            if (checkSettingsSwagger) {
                swaggerDefinition.paths = { ...swaggerDefinition.paths, ...checkSettingsSwagger.paths };
                swaggerDefinition.definitions = { ...swaggerDefinition.definitions, ...checkSettingsSwagger.definitions };
            }
        }

        const refreshWorker = QueenStore.getInstance().workers.find((worker: [HiveWorker, any]) => worker[0].name === "ohreqRestSystemRefresh");

        if (refreshWorker) {
            const refreshInstance: IRestEndpointWorker = refreshWorker[1] as IRestEndpointWorker;
            refreshInstance.register(app, OmniHiveConstants.SYSTEM_REST_ROOT);

            const refreshWorkerSwagger: swaggerUi.JsonObject | undefined = refreshInstance.getSwaggerDefinition();

            if (refreshWorkerSwagger) {
                swaggerDefinition.paths = { ...swaggerDefinition.paths, ...refreshWorkerSwagger.paths };
                swaggerDefinition.definitions = { ...swaggerDefinition.definitions, ...refreshWorkerSwagger.definitions };
            }
        }

        const statusWorker = QueenStore.getInstance().workers.find((worker: [HiveWorker, any]) => worker[0].name === "ohreqRestSystemStatus");

        if (statusWorker) {
            const statusInstance: IRestEndpointWorker = statusWorker[1] as IRestEndpointWorker;
            statusInstance.register(app, OmniHiveConstants.SYSTEM_REST_ROOT);

            const statusWorkerSwagger: swaggerUi.JsonObject | undefined = statusInstance.getSwaggerDefinition();

            if (statusWorkerSwagger) {
                swaggerDefinition.paths = { ...swaggerDefinition.paths, ...statusWorkerSwagger.paths };
                swaggerDefinition.definitions = { ...swaggerDefinition.definitions, ...statusWorkerSwagger.definitions };
            }
        }

        if (QueenStore.getInstance().settings.server.enableSwagger) {
            app.use(`${OmniHiveConstants.SYSTEM_REST_ROOT}/api-docs`, swaggerUi.serve, swaggerUi.setup(swaggerDefinition));
        }

        return app;

    }

    public getRootUrlPathName = (): string => {
        const rootUrl: URL = new URL(QueenStore.getInstance().settings.server.rootUrl);
        return rootUrl.pathname;
    }

    public initApp = async (settingsPath: string | undefined, packageJson: NormalizedReadResult | undefined): Promise<void> => {

        if (!packageJson) {
            throw new Error("Package.json must be given to load packages");
        }

        // Load Core Workers
        if (packageJson && packageJson.packageJson && packageJson.packageJson.omniHive && packageJson.packageJson.omniHive.coreWorkers) {
            const coreWorkers: HiveWorker[] = packageJson.packageJson.omniHive.coreWorkers as HiveWorker[];

            for (const coreWorker of coreWorkers) {

                Object.keys(coreWorker.metadata).forEach((metaKey: string) => {
                    if (typeof coreWorker.metadata[metaKey] === "string") {
                        if ((coreWorker.metadata[metaKey] as string).startsWith("${") && (coreWorker.metadata[metaKey] as string).endsWith("}")) {
                            let metaValue: string = coreWorker.metadata[metaKey] as string;

                            metaValue = metaValue.substr(2, metaValue.length - 3);
                            const envValue: string | undefined = process.env[metaValue];

                            if (envValue) {
                                coreWorker.metadata[metaKey] = envValue;
                            }
                        }
                    }
                });

                await QueenStore.getInstance().registerWorker(coreWorker);
                QueenStore.getInstance().settings.workers.push(coreWorker);
            }
        }

        if (!settingsPath || StringHelper.isNullOrWhiteSpace(settingsPath)) {
            throw new Error("Settings path must be given to init function");
        }

        const fileSystemWorker: IFileSystemWorker | undefined = await QueenStore.getInstance().getHiveWorker<IFileSystemWorker>(HiveWorkerType.FileSystem, "ohreqFileSystemWorker");

        if (!fileSystemWorker) {
            throw new Error("Core FileSystem Worker Not Found.  Server needs the core file worker ohreqFileSystemWorker");
        }

        // Get Server Settings
        const settingsJson: SystemSettings = JSON.parse(fileSystemWorker.readFile(`${settingsPath}`));
        QueenStore.getInstance().settings = settingsJson;

        const logWorker: ILogWorker | undefined = await QueenStore.getInstance().getHiveWorker<ILogWorker>(HiveWorkerType.Log, "ohreqLogWorker");

        if (!logWorker) {
            throw new Error("Core Log Worker Not Found.  App worker needs the core log worker ohreqLogWorker");
        }

        logWorker.write(OmniHiveLogLevel.Info, `Server Settings Retrieved...`);

        // Load Workers
        logWorker.write(OmniHiveLogLevel.Info, `Registering default workers from package.json...`);

        // Load Default Workers
        if (packageJson && packageJson.packageJson && packageJson.packageJson.omniHive && packageJson.packageJson.omniHive.defaultWorkers) {
            const defaultWorkers: HiveWorker[] = packageJson.packageJson.omniHive.defaultWorkers as HiveWorker[];

            defaultWorkers.forEach((defaultWorker: HiveWorker) => {

                if (!QueenStore.getInstance().settings.workers.some((hiveWorker: HiveWorker) => hiveWorker.type === defaultWorker.type)) {
                    Object.keys(defaultWorker.metadata).forEach((metaKey: string) => {
                        if (typeof defaultWorker.metadata[metaKey] === "string") {
                            if ((defaultWorker.metadata[metaKey] as string).startsWith("${") && (defaultWorker.metadata[metaKey] as string).endsWith("}")) {
                                let metaValue: string = defaultWorker.metadata[metaKey] as string;

                                metaValue = metaValue.substr(2, metaValue.length - 3);
                                const envValue: string | undefined = process.env[metaValue];

                                if (envValue) {
                                    defaultWorker.metadata[metaKey] = envValue;
                                }
                            }
                        }
                    });

                    QueenStore.getInstance().settings.workers.push(defaultWorker);
                }

            });
        }

        logWorker.write(OmniHiveLogLevel.Info, `Working on hive worker packages...`);

        if (packageJson && packageJson.packageJson && packageJson.packageJson.dependencies && packageJson.packageJson.omniHive && packageJson.packageJson.omniHive.coreDependencies) {

            // Build lists
            const corePackages: any = packageJson.packageJson.omniHive.coreDependencies;
            const loadedPackages: any = packageJson.packageJson.dependencies;
            const workerPackages: any = {};

            QueenStore.getInstance().settings.workers.forEach((hiveWorker: HiveWorker) => {
                workerPackages[hiveWorker.package] = hiveWorker.version;
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

                spawn.sync(removeCommand.outputString(), { shell: true, cwd: process.cwd() });
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

                spawn.sync(addCommand.outputString(), { shell: true, cwd: process.cwd() });
            }
        }

        logWorker.write(OmniHiveLogLevel.Debug, "Custom packages complete");

        // Register hive workers
        logWorker.write(OmniHiveLogLevel.Debug, "Working on hive workers...");
        await QueenStore.getInstance().initWorkers(QueenStore.getInstance().settings.workers);
        logWorker.write(OmniHiveLogLevel.Debug, "Hive Workers Initiated...");

        // Get account if hive worker exists
        if (QueenStore.getInstance().workers.some((hiveWorker: [HiveWorker, any]) => hiveWorker[0].type === HiveWorkerType.HiveAccount)) {
            const accoutWorker: [HiveWorker, any] | undefined = QueenStore.getInstance().workers.find((hiveWorker: [HiveWorker, any]) => hiveWorker[0].type === HiveWorkerType.HiveAccount);

            if (accoutWorker) {
                const accountWorkerInstance: IHiveAccountWorker = accoutWorker[1] as IHiveAccountWorker;
                QueenStore.getInstance().account = await accountWorkerInstance.getHiveAccount();
            }
        }
    }

    public loadSpecialStatusApp = async (status: ServerStatus, error?: Error): Promise<void> => {

        if (QueenStore.getInstance().status.serverStatus === ServerStatus.Admin ||
            QueenStore.getInstance().status.serverStatus === ServerStatus.Rebuilding) {
            return;
        }

        QueenStore.getInstance().changeSystemStatus(status, error);

        const app: core.Express = this.getCleanAppServer();

        app.get("/", (_req, res) => {
            res.setHeader('Content-Type', 'application/json');
            return res.status(200).json(QueenStore.getInstance().status);
        });

        this.appServer = app;
    }

    public serverChangeHandler = async (): Promise<void> => {

        const logWorker: ILogWorker | undefined = await QueenStore.getInstance().getHiveWorker<ILogWorker>(HiveWorkerType.Log, "ohreqLogWorker");

        if (!logWorker) {
            throw new Error("Core Log Worker Not Found.  Server needs the core log worker ohreqLogWorker");
        }

        logWorker.write(OmniHiveLogLevel.Info, `Server Change Handler Started`);

        const server: Server = http.createServer(this.appServer);

        if (this.webServer) {
            this.webServer.removeAllListeners().close();
        }

        this.webServer = server;

        this.webServer.listen(QueenStore.getInstance().settings.server.portNumber, () => {
            logWorker.write(OmniHiveLogLevel.Info, `New Server Listening on process ${process.pid} using port ${QueenStore.getInstance().settings.server.portNumber}`);
        });

        logWorker.write(OmniHiveLogLevel.Info, `Server Change Handler Completed`);

    }
}
