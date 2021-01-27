import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { OmniHiveLogLevel } from "@withonevision/omnihive-core/enums/OmniHiveLogLevel";
import { ServerStatus } from "@withonevision/omnihive-core/enums/ServerStatus";
import { ObjectHelper } from "@withonevision/omnihive-core/helpers/ObjectHelper";
import { ILogWorker } from "@withonevision/omnihive-core/interfaces/ILogWorker";
import { IRestEndpointWorker } from "@withonevision/omnihive-core/interfaces/IRestEndpointWorker";
import { HiveWorker } from "@withonevision/omnihive-core/models/HiveWorker";
import { HiveWorkerMetadataRestFunction } from "@withonevision/omnihive-core/models/HiveWorkerMetadataRestFunction";
import { OmniHiveConstants } from "@withonevision/omnihive-core/models/OmniHiveConstants";
import { CommonStore } from "@withonevision/omnihive-core/stores/CommonStore";
import bodyParser from "body-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import http, { Server } from "http";
import next from "next";
import NextServer from "next/dist/next-server/server/next-server";
import { serializeError } from "serialize-error";
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

    public getCleanAppServer = async (): Promise<express.Express> => {
        const logWorker: ILogWorker | undefined = await CommonStore.getInstance().getHiveWorker<ILogWorker>(
            HiveWorkerType.Log,
            "ohreqLogWorker"
        );

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
                    url: `${CommonStore.getInstance().settings.config.rootUrl}${OmniHiveConstants.SYSTEM_REST_ROOT}`,
                },
            ],
            paths: {},
            definitions: {},
        };

        CommonStore.getInstance()
            .workers.filter(
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

        const app: express.Express = await this.getCleanAppServer();

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
