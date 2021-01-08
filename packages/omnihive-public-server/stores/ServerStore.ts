import { ServerStatus } from "@withonevision/omnihive-hive-common/enums/ServerStatus";
import { HiveWorker } from "@withonevision/omnihive-hive-common/models/HiveWorker";
import { OmniHiveConstants } from "@withonevision/omnihive-hive-common/models/OmniHiveConstants";
import { QueenStore } from "@withonevision/omnihive-hive-queen/stores/QueenStore";
import { HiveWorkerFactory } from "@withonevision/omnihive-hive-worker/HiveWorkerFactory";
import { IRestEndpointWorker } from "@withonevision/omnihive-hive-worker/interfaces/IRestEndpointWorker";
import bodyParser from "body-parser";
import cors from "cors";
import express from "express";
import * as core from "express-serve-static-core";
import helmet from "helmet";
import { Server } from "http";
import next from "next";
import NextServer from "next/dist/next-server/server/next-server";
import swaggerUi from "swagger-ui-express";
import { parse } from "url";

export class ServerStore {

    private static instance: ServerStore;

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    private constructor() { }

    public static getInstance = (): ServerStore => {
        if (!ServerStore.instance) {
            ServerStore.instance = new ServerStore();
        }

        return ServerStore.instance;
    }

    public static getNew = (): ServerStore => {
        return new ServerStore();
    }

    public appServer!: core.Express;
    public webServer: Server | undefined = undefined;

    private adminServer: NextServer | undefined = undefined;
    private adminServerPreparing: boolean = false;

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

        const accessTokenWorker = HiveWorkerFactory.getInstance().workers.find((worker: [HiveWorker, any]) => worker[0].name === "ohreqRestSystemAccessToken");

        if (accessTokenWorker) {
            const accessTokenInstance: IRestEndpointWorker = accessTokenWorker[1] as IRestEndpointWorker;
            accessTokenInstance.register(app, OmniHiveConstants.SYSTEM_REST_ROOT);

            const accessTokenSwagger: swaggerUi.JsonObject | undefined = accessTokenInstance.getSwaggerDefinition();

            if (accessTokenSwagger) {
                swaggerDefinition.paths = { ...swaggerDefinition.paths, ...accessTokenSwagger.paths };
                swaggerDefinition.definitions = { ...swaggerDefinition.definitions, ...accessTokenSwagger.definitions };
            }
        }

        const checkSettingsWorker = HiveWorkerFactory.getInstance().workers.find((worker: [HiveWorker, any]) => worker[0].name === "ohreqRestSystemCheckSettings");

        if (checkSettingsWorker) {
            const checkSettingInstance: IRestEndpointWorker = checkSettingsWorker[1] as IRestEndpointWorker;
            checkSettingInstance.register(app, OmniHiveConstants.SYSTEM_REST_ROOT);

            const checkSettingsSwagger: swaggerUi.JsonObject | undefined = checkSettingInstance.getSwaggerDefinition();

            if (checkSettingsSwagger) {
                swaggerDefinition.paths = { ...swaggerDefinition.paths, ...checkSettingsSwagger.paths };
                swaggerDefinition.definitions = { ...swaggerDefinition.definitions, ...checkSettingsSwagger.definitions };
            }
        }

        const refreshWorker = HiveWorkerFactory.getInstance().workers.find((worker: [HiveWorker, any]) => worker[0].name === "ohreqRestSystemRefresh");

        if (refreshWorker) {
            const refreshInstance: IRestEndpointWorker = refreshWorker[1] as IRestEndpointWorker;
            refreshInstance.register(app, OmniHiveConstants.SYSTEM_REST_ROOT);

            const refreshWorkerSwagger: swaggerUi.JsonObject | undefined = refreshInstance.getSwaggerDefinition();

            if (refreshWorkerSwagger) {
                swaggerDefinition.paths = { ...swaggerDefinition.paths, ...refreshWorkerSwagger.paths };
                swaggerDefinition.definitions = { ...swaggerDefinition.definitions, ...refreshWorkerSwagger.definitions };
            }
        }

        const statusWorker = HiveWorkerFactory.getInstance().workers.find((worker: [HiveWorker, any]) => worker[0].name === "ohreqRestSystemStatus");

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
}
