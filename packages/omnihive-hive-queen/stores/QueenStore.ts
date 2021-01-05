import { ServerStatus } from "@withonevision/omnihive-hive-common/enums/ServerStatus";
import { HiveAccount } from "@withonevision/omnihive-hive-common/models/HiveAccount";
import { OmniHiveConstants } from "@withonevision/omnihive-hive-common/models/OmniHiveConstants";
import { SystemSettings } from "@withonevision/omnihive-hive-common/models/SystemSettings";
import { SystemStatus } from "@withonevision/omnihive-hive-common/models/SystemStatus";
import bodyParser from "body-parser";
import cors from "cors";
import express from "express";
import * as core from "express-serve-static-core";
import helmet from "helmet";
import { Server } from "http";
import next from "next";
import NextServer from "next/dist/next-server/server/next-server";
import { serializeError } from "serialize-error";
import swaggerUi from "swagger-ui-express";
import { parse } from "url";
import SystemAccessTokenDrone from "../drones/SystemAccessTokenDrone";
import SystemCheckSettingsDrone from "../drones/SystemCheckSettingsDrone";
import SystemRefreshDrone from "../drones/SystemRefreshDrone";
import SystemStatusDrone from "../drones/SystemStatusDrone";

export class QueenStore {

    private static instance: QueenStore;

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    private constructor() { }

    public static getInstance = (): QueenStore => {
        if (!QueenStore.instance) {
            QueenStore.instance = new QueenStore();
        }

        return QueenStore.instance;
    }

    public static getNew = (): QueenStore => {
        return new QueenStore();
    }

    public account: HiveAccount = new HiveAccount();
    public appServer!: core.Express;
    public settings: SystemSettings = new SystemSettings();
    public webServer: Server | undefined = undefined;

    private _status: SystemStatus = new SystemStatus();

    private adminServer: NextServer | undefined = undefined;
    private adminServerPreparing: boolean = false;

    public get status(): SystemStatus {
        return this._status;
    }

    public changeSystemStatus = (serverStatus: ServerStatus, error?: Error): void => {

        const systemStatus: SystemStatus = new SystemStatus();
        systemStatus.serverStatus = serverStatus;

        if (error) {
            systemStatus.serverError = serializeError(error);
        } else {
            systemStatus.serverError = {};
        }

        this._status = systemStatus;
    }

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

            const nextApp = next({ dev: this.settings.server.developerMode });
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
                title: "OmniHive System Drone REST Interface",
                version: "1.0.0",
                description: "All system REST endpoint drones provided for OmniHive functionality",
            },
            license: {},
            openapi: "3.0.0",
            servers: [
                {
                    url: `${this.settings.server.rootUrl}${OmniHiveConstants.SYSTEM_REST_ROOT}`,
                },
            ],
            paths: {},
            definitions: {}
        };

        const accessTokenDrone = new SystemAccessTokenDrone();
        accessTokenDrone.register(app, OmniHiveConstants.SYSTEM_REST_ROOT);

        swaggerDefinition.paths = { ...swaggerDefinition.paths, ...accessTokenDrone.getSwaggerDefinition().paths };
        swaggerDefinition.definitions = { ...swaggerDefinition.definitions, ...accessTokenDrone.getSwaggerDefinition().definitions };

        const checkSettingsDrone = new SystemCheckSettingsDrone();
        checkSettingsDrone.register(app, OmniHiveConstants.SYSTEM_REST_ROOT);

        swaggerDefinition.paths = { ...swaggerDefinition.paths, ...checkSettingsDrone.getSwaggerDefinition().paths };
        swaggerDefinition.definitions = { ...swaggerDefinition.definitions, ...checkSettingsDrone.getSwaggerDefinition().definitions };

        const refreshDrone = new SystemRefreshDrone();
        refreshDrone.register(app, OmniHiveConstants.SYSTEM_REST_ROOT);

        swaggerDefinition.paths = { ...swaggerDefinition.paths, ...refreshDrone.getSwaggerDefinition().paths };
        swaggerDefinition.definitions = { ...swaggerDefinition.definitions, ...refreshDrone.getSwaggerDefinition().definitions };

        const statusDrone = new SystemStatusDrone();
        statusDrone.register(app, OmniHiveConstants.SYSTEM_REST_ROOT);

        swaggerDefinition.paths = { ...swaggerDefinition.paths, ...statusDrone.getSwaggerDefinition().paths };
        swaggerDefinition.definitions = { ...swaggerDefinition.definitions, ...statusDrone.getSwaggerDefinition().definitions };

        if (this.settings.server.enableSwagger) {
            app.use(`${OmniHiveConstants.SYSTEM_REST_ROOT}/api-docs`, swaggerUi.serve, swaggerUi.setup(swaggerDefinition));
        }

        return app;

    }

    public getRootUrlPathName = (): string => {
        const rootUrl: URL = new URL(this.settings.server.rootUrl);
        return rootUrl.pathname;
    }

    public loadSpecialStatusApp = async (status: ServerStatus, error?: Error): Promise<void> => {

        if (this.status.serverStatus === ServerStatus.Admin ||
            this.status.serverStatus === ServerStatus.Rebuilding) {
            return;
        }

        this.changeSystemStatus(status, error);

        const app: core.Express = this.getCleanAppServer();

        app.get("/", (_req, res) => {
            res.setHeader('Content-Type', 'application/json');
            return res.status(200).json(this.status);
        });

        this.appServer = app;
    }
}
