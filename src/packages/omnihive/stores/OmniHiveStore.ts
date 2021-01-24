import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { OmniHiveLogLevel } from "@withonevision/omnihive-core/enums/OmniHiveLogLevel";
import { ServerStatus } from "@withonevision/omnihive-core/enums/ServerStatus";
import { ILogWorker } from "@withonevision/omnihive-core/interfaces/ILogWorker";
import { IRestEndpointWorker } from "@withonevision/omnihive-core/interfaces/IRestEndpointWorker";
import { HiveWorker } from "@withonevision/omnihive-core/models/HiveWorker";
import { OmniHiveConstants } from "@withonevision/omnihive-core/models/OmniHiveConstants";
import { CommonStore } from "@withonevision/omnihive-core/stores/CommonStore";
import bodyParser from "body-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import http, { Server } from "http";
import next from "next";
import NextServer from "next/dist/next-server/server/next-server";
import swaggerUi from "swagger-ui-express";
import { parse } from "url";

export class OmniHiveStore {
    private static instance: OmniHiveStore;

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    private constructor() {}

    public static getInstance = (): OmniHiveStore => {
        if (!OmniHiveStore.instance) {
            OmniHiveStore.instance = new OmniHiveStore();
        }

        return OmniHiveStore.instance;
    };

    public static getNew = (): OmniHiveStore => {
        return new OmniHiveStore();
    };

    public adminServer: NextServer | undefined = undefined;
    public adminServerPreparing: boolean = false;
    public appServer!: express.Express;
    public webServer: Server | undefined = undefined;

    public getCleanAppServer = (): express.Express => {
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

            const nextApp = next({ dev: CommonStore.getInstance().settings.config.developerMode });
            nextApp.prepare().then(() => {
                this.adminServer = nextApp;
                this.adminServerPreparing = false;
            });
        }

        app.get("/admin", (req, res) => {
            if (!this.adminServer) {
                res.setHeader("Content-Type", "application/json");
                return res.status(200).json({ adminStatus: "loading" });
            }

            const handle = this.adminServer.getRequestHandler();
            const parsedUrl = parse(req.url, true);
            return handle(req, res, parsedUrl);
        });

        app.get("/admin/*", (req, res) => {
            if (!this.adminServer) {
                res.setHeader("Content-Type", "application/json");
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
                    url: `${CommonStore.getInstance().settings.config.rootUrl}${OmniHiveConstants.SYSTEM_REST_ROOT}`,
                },
            ],
            paths: {},
            definitions: {},
        };

        const accessTokenWorker = CommonStore.getInstance().workers.find(
            (worker: [HiveWorker, any]) => worker[0].name === "ohreqRestSystemAccessToken"
        );

        if (accessTokenWorker) {
            const accessTokenInstance: IRestEndpointWorker = accessTokenWorker[1] as IRestEndpointWorker;
            accessTokenInstance.register(app, OmniHiveConstants.SYSTEM_REST_ROOT);

            const accessTokenSwagger: swaggerUi.JsonObject | undefined = accessTokenInstance.getSwaggerDefinition();

            if (accessTokenSwagger) {
                swaggerDefinition.paths = { ...swaggerDefinition.paths, ...accessTokenSwagger.paths };
                swaggerDefinition.definitions = { ...swaggerDefinition.definitions, ...accessTokenSwagger.definitions };
            }
        }

        const checkSettingsWorker = CommonStore.getInstance().workers.find(
            (worker: [HiveWorker, any]) => worker[0].name === "ohreqRestSystemCheckSettings"
        );

        if (checkSettingsWorker) {
            const checkSettingInstance: IRestEndpointWorker = checkSettingsWorker[1] as IRestEndpointWorker;
            checkSettingInstance.register(app, OmniHiveConstants.SYSTEM_REST_ROOT);

            const checkSettingsSwagger: swaggerUi.JsonObject | undefined = checkSettingInstance.getSwaggerDefinition();

            if (checkSettingsSwagger) {
                swaggerDefinition.paths = { ...swaggerDefinition.paths, ...checkSettingsSwagger.paths };
                swaggerDefinition.definitions = {
                    ...swaggerDefinition.definitions,
                    ...checkSettingsSwagger.definitions,
                };
            }
        }

        const refreshWorker = CommonStore.getInstance().workers.find(
            (worker: [HiveWorker, any]) => worker[0].name === "ohreqRestSystemRefresh"
        );

        if (refreshWorker) {
            const refreshInstance: IRestEndpointWorker = refreshWorker[1] as IRestEndpointWorker;
            refreshInstance.register(app, OmniHiveConstants.SYSTEM_REST_ROOT);

            const refreshWorkerSwagger: swaggerUi.JsonObject | undefined = refreshInstance.getSwaggerDefinition();

            if (refreshWorkerSwagger) {
                swaggerDefinition.paths = { ...swaggerDefinition.paths, ...refreshWorkerSwagger.paths };
                swaggerDefinition.definitions = {
                    ...swaggerDefinition.definitions,
                    ...refreshWorkerSwagger.definitions,
                };
            }
        }

        const statusWorker = CommonStore.getInstance().workers.find(
            (worker: [HiveWorker, any]) => worker[0].name === "ohreqRestSystemStatus"
        );

        if (statusWorker) {
            const statusInstance: IRestEndpointWorker = statusWorker[1] as IRestEndpointWorker;
            statusInstance.register(app, OmniHiveConstants.SYSTEM_REST_ROOT);

            const statusWorkerSwagger: swaggerUi.JsonObject | undefined = statusInstance.getSwaggerDefinition();

            if (statusWorkerSwagger) {
                swaggerDefinition.paths = { ...swaggerDefinition.paths, ...statusWorkerSwagger.paths };
                swaggerDefinition.definitions = {
                    ...swaggerDefinition.definitions,
                    ...statusWorkerSwagger.definitions,
                };
            }
        }

        if (CommonStore.getInstance().settings.config.enableSwagger) {
            app.use(
                `${OmniHiveConstants.SYSTEM_REST_ROOT}/api-docs`,
                swaggerUi.serve,
                swaggerUi.setup(swaggerDefinition)
            );
        }

        return app;
    };

    public getRootUrlPathName = (): string => {
        const rootUrl: URL = new URL(CommonStore.getInstance().settings.config.rootUrl);
        return rootUrl.pathname;
    };

    public loadSpecialStatusApp = async (status: ServerStatus, error?: Error): Promise<void> => {
        if (
            CommonStore.getInstance().status.serverStatus === ServerStatus.Admin ||
            CommonStore.getInstance().status.serverStatus === ServerStatus.Rebuilding
        ) {
            return;
        }

        CommonStore.getInstance().changeSystemStatus(status, error);

        const app: express.Express = this.getCleanAppServer();

        app.get("/", (_req, res) => {
            res.setHeader("Content-Type", "application/json");
            return res.status(200).json(CommonStore.getInstance().status);
        });

        this.appServer = app;
    };

    public serverChangeHandler = async (): Promise<void> => {
        const logWorker: ILogWorker | undefined = await CommonStore.getInstance().getHiveWorker<ILogWorker>(
            HiveWorkerType.Log,
            "ohreqLogWorker"
        );

        if (!logWorker) {
            throw new Error("Core Log Worker Not Found.  Server needs the core log worker ohreqLogWorker");
        }

        logWorker.write(OmniHiveLogLevel.Info, `Server Change Handler Started`);

        const server: Server = http.createServer(this.appServer);

        if (this.webServer) {
            this.webServer.removeAllListeners().close();
        }

        this.webServer = server;

        this.webServer.listen(CommonStore.getInstance().settings.config.portNumber, () => {
            logWorker.write(
                OmniHiveLogLevel.Info,
                `New Server Listening on process ${process.pid} using port ${
                    CommonStore.getInstance().settings.config.portNumber
                }`
            );
        });

        logWorker.write(OmniHiveLogLevel.Info, `Server Change Handler Completed`);
    };
}
