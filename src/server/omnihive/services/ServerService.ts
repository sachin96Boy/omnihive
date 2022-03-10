/// <reference path="../../../types/globals.omnihive.d.ts" />

import { AdminEventType } from "@withonevision/omnihive-core/enums/AdminEventType";
import { AdminRoomType } from "@withonevision/omnihive-core/enums/AdminRoomType";
import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { OmniHiveLogLevel } from "@withonevision/omnihive-core/enums/OmniHiveLogLevel";
import { RegisteredHiveWorkerSection } from "@withonevision/omnihive-core/enums/RegisteredHiveWorkerSection";
import { RegisteredUrlType } from "@withonevision/omnihive-core/enums/RegisteredUrlType";
import { ServerStatus } from "@withonevision/omnihive-core/enums/ServerStatus";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { IsHelper } from "@withonevision/omnihive-core/helpers/IsHelper";
import { ObjectHelper } from "@withonevision/omnihive-core/helpers/ObjectHelper";
import { ILogWorker } from "@withonevision/omnihive-core/interfaces/ILogWorker";
import { IRestEndpointWorker } from "@withonevision/omnihive-core/interfaces/IRestEndpointWorker";
import { IServerWorker } from "@withonevision/omnihive-core/interfaces/IServerWorker";
import { HiveWorkerMetadataRestFunction } from "@withonevision/omnihive-core/models/HiveWorkerMetadataRestFunction";
import { RegisteredHiveWorker } from "@withonevision/omnihive-core/models/RegisteredHiveWorker";
import { RestEndpointExecuteResponse } from "@withonevision/omnihive-core/models/RestEndpointExecuteResponse";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import http, { Server } from "http";
import path from "path";
import { serializeError } from "serialize-error";
import swaggerUi from "swagger-ui-express";
import { CommandLineArgs } from "../models/CommandLineArgs";
import { AdminService } from "./AdminService";
import { CommonService } from "./CommonService";
import { ApolloServerExpressConfig, ApolloServer } from "apollo-server-express";
import { StringBuilder } from "@withonevision/omnihive-core/helpers/StringBuilder";
import { runInNewContext } from "vm";
import Module from "module";
import { nanoid } from "nanoid";
import { ApolloServerPluginLandingPageGraphQLPlayground } from "apollo-server-core";
import { transformSync } from "esbuild";
export class ServerService {
    private webRootUrl: string = "";
    private webPortNumber: number = 3001;

    public run = async (rootDir: string, commandLineArgs: CommandLineArgs): Promise<void> => {
        const commonService: CommonService = new CommonService();

        //Run environment loader
        await AwaitHelper.execute(commonService.bootLoader(rootDir, commandLineArgs));

        //Setup environment
        this.webRootUrl = global.omnihive.getEnvironmentVariable<string>("OH_WEB_ROOT_URL") ?? "";
        this.webPortNumber = global.omnihive.getEnvironmentVariable<number>("OH_WEB_PORT_NUMBER") ?? 3001;

        const customGraphSlug =
            global.omnihive.getEnvironmentVariable<string>("OH_WEB_CUSTOM_GRAPH_SLUG") ?? "/custom/graphql";
        const customRestSlug =
            global.omnihive.getEnvironmentVariable<string>("OH_WEB_CUSTOM_REST_SLUG") ?? "/custom/rest";
        const graphIntrospection =
            global.omnihive.getEnvironmentVariable<boolean>("OH_CORE_GRAPH_INTROSPECTION") ?? false;
        const graphPlayground = global.omnihive.getEnvironmentVariable<boolean>("OH_CORE_GRAPH_PLAYGROUND") ?? true;
        const swagger = global.omnihive.getEnvironmentVariable<boolean>("OH_CORE_SWAGGER");

        if (
            IsHelper.isNullOrUndefinedOrEmptyStringOrWhitespace(this.webRootUrl) ||
            IsHelper.isNullOrUndefined(this.webPortNumber)
        ) {
            throw new Error("Web root url or port number is undefined");
        }

        const logWorker: ILogWorker | undefined = global.omnihive.getWorker<ILogWorker>(
            HiveWorkerType.Log,
            "__ohBootLogWorker"
        );

        try {
            // Reboot admin service
            const adminService: AdminService = new AdminService();
            await AwaitHelper.execute(adminService.run());

            // Set server to rebuilding first
            await AwaitHelper.execute(this.changeServerStatus(ServerStatus.Rebuilding));

            // Run worker loader
            await AwaitHelper.execute(commonService.workerLoader());

            // Try to spin up full server
            let app: express.Express = await AwaitHelper.execute(this.getCleanAppServer());

            const servers: RegisteredHiveWorker[] = global.omnihive.registeredWorkers.filter(
                (rw: RegisteredHiveWorker) => rw.type === HiveWorkerType.Server
            );

            for (const server of servers) {
                logWorker?.write(OmniHiveLogLevel.Info, `Server Worker ${server.name} => Begin Build`);
                app = await AwaitHelper.execute((server.instance as IServerWorker).buildServer(app));
                logWorker?.write(OmniHiveLogLevel.Info, `Server Worker ${server.name} => Build Complete`);
            }

            // Build custom graph workers
            logWorker?.write(OmniHiveLogLevel.Info, `Master Web Process => Custom Graph Generation Started`);

            let graphEndpointModule: any | undefined = undefined;

            const customGraphWorkers: RegisteredHiveWorker[] = global.omnihive.registeredWorkers.filter(
                (worker: RegisteredHiveWorker) => worker.type === HiveWorkerType.GraphEndpointFunction
            );
            if (!IsHelper.isEmptyArray(customGraphWorkers)) {
                const builder: StringBuilder = new StringBuilder();

                // Build imports
                builder.appendLine(
                    `const { GraphQLInt, GraphQLSchema, GraphQLString, GraphQLBoolean, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLInputObjectType } = require("graphql");`
                );
                builder.appendLine(
                    `const { AwaitHelper } = require("@withonevision/omnihive-core/helpers/AwaitHelper");`
                );
                builder.appendLine(
                    `const { GraphQLJSONObject } = require("@withonevision/omnihive-core/models/GraphQLJSON");`
                );
                builder.appendLine(
                    `const { HiveWorkerType } = require("@withonevision/omnihive-core/enums/HiveWorkerType");`
                );
                builder.appendLine(`const { CustomGraphHelper } = require("../helpers/CustomGraphHelper");`);
                builder.appendLine();

                // Build main graph schema
                builder.appendLine(`exports.FederatedCustomFunctionQuerySchema = new GraphQLSchema({`);

                // Query Object Type
                builder.appendLine(`\tquery: new GraphQLObjectType({`);
                builder.appendLine(`\t\tname: 'Query',`);
                builder.appendLine(`\t\tfields: () => ({`);

                // Loop through graph endpoints

                customGraphWorkers.forEach((worker: RegisteredHiveWorker) => {
                    builder.appendLine(`\t\t\t${worker.name}: {`);
                    builder.appendLine(`\t\t\t\ttype: GraphQLJSONObject,`);
                    builder.appendLine(`\t\t\t\targs: {`);
                    builder.appendLine(`\t\t\t\t\tcustomArgs: { type: GraphQLJSONObject },`);
                    builder.appendLine(`\t\t\t\t},`);
                    builder.appendLine(`\t\t\t\tresolve: async (parent, args, context, resolveInfo) => {`);
                    builder.appendLine(`\t\t\t\t\tvar graphHelper = new CustomGraphHelper();`);
                    builder.appendLine(
                        `\t\t\t\t\tvar customFunctionReturn = await AwaitHelper.execute(graphHelper.parseCustomGraph("${worker.name}", args.customArgs, context.omnihive));`
                    );
                    builder.appendLine(`\t\t\t\t\treturn customFunctionReturn;`);
                    builder.appendLine(`\t\t\t\t},`);
                    builder.appendLine(`\t\t\t},`);
                });

                builder.appendLine(`\t\t})`);
                builder.appendLine(`\t}),`);
                builder.appendLine(`});`);

                graphEndpointModule = this.importFromString(builder.outputString());
            }

            logWorker?.write(OmniHiveLogLevel.Info, `Master Web Process => Graph Generation Files Completed`);
            logWorker?.write(OmniHiveLogLevel.Info, `Master Web Process => Graph Schema Build Completed Successfully`);
            logWorker?.write(OmniHiveLogLevel.Info, `Master Web Process => Booting Up Graph Server`);

            // Register custom graph apollo server
            logWorker?.write(
                OmniHiveLogLevel.Info,
                `Master Web Process => Custom Functions Graph Endpoint Registering`
            );

            if (
                global.omnihive.registeredWorkers.some(
                    (worker: RegisteredHiveWorker) => worker.type === HiveWorkerType.GraphEndpointFunction
                ) &&
                !IsHelper.isNullOrUndefined(graphEndpointModule)
            ) {
                const functionDynamicModule: any = graphEndpointModule;
                const graphFunctionSchema: any = functionDynamicModule.FederatedCustomFunctionQuerySchema;

                const graphFunctionConfig: ApolloServerExpressConfig = {
                    introspection: graphIntrospection,
                    schema: graphFunctionSchema,
                    context: async ({ req }) => {
                        const omnihive = {
                            access: req.headers["x-omnihive-access"] || ``,
                            auth: req.headers.authorization || ``,
                            cache: req.headers["x-omnihive-cache-type"] || ``,
                            cacheSeconds: req.headers["x-omnihive-cache-seconds"],
                        };
                        return { omnihive };
                    },
                };

                if (graphPlayground) {
                    graphFunctionConfig.plugins?.push(
                        ApolloServerPluginLandingPageGraphQLPlayground({
                            endpoint: `${this.webRootUrl}${customGraphSlug}`,
                        })
                    );
                }

                const graphFunctionServer: ApolloServer = new ApolloServer(graphFunctionConfig);
                await AwaitHelper.execute(graphFunctionServer.start());
                graphFunctionServer.applyMiddleware({
                    app,
                    path: `${customGraphSlug}`,
                });

                global.omnihive.registeredUrls.push({
                    path: `${this.webRootUrl}${customGraphSlug}`,
                    type: RegisteredUrlType.GraphFunction,
                    metadata: {},
                });
            }

            logWorker?.write(OmniHiveLogLevel.Info, `Master Web Process => Custom Functions Endpoint Registered`);
            logWorker?.write(OmniHiveLogLevel.Info, `Master Web Process => REST Server Generation Started`);

            // Register "custom" REST endpoints
            if (
                global.omnihive.registeredWorkers.some(
                    (worker: RegisteredHiveWorker) => worker.type === HiveWorkerType.RestEndpointFunction
                )
            ) {
                const swaggerDefinition: swaggerUi.JsonObject = {
                    info: {
                        title: "OmniHive Custom Function REST Interface",
                        version: "1.0.0",
                        description:
                            "All custom REST endpoint functions written by the OmniHive account administrators",
                    },
                    license: {},
                    openapi: "3.0.0",
                    servers: [
                        {
                            url: `${this.webRootUrl}${customRestSlug}`,
                        },
                    ],
                };

                const restWorkers = global.omnihive.registeredWorkers.filter(
                    (rw: RegisteredHiveWorker) =>
                        rw.type === HiveWorkerType.RestEndpointFunction &&
                        rw.section === RegisteredHiveWorkerSection.User
                );

                restWorkers.forEach((rw: RegisteredHiveWorker) => {
                    let workerMetaData: HiveWorkerMetadataRestFunction;

                    try {
                        workerMetaData = ObjectHelper.createStrict<HiveWorkerMetadataRestFunction>(
                            HiveWorkerMetadataRestFunction,
                            rw.metadata
                        );
                    } catch (error) {
                        logWorker?.write(
                            OmniHiveLogLevel.Error,
                            `Cannot register custom REST worker ${rw.name}.  MetaData is incorrect.`
                        );

                        return;
                    }

                    const workerInstance: IRestEndpointWorker = rw.instance as IRestEndpointWorker;

                    app[workerMetaData.restMethod](
                        `${customRestSlug}${workerMetaData.urlRoute}`,
                        async (req: express.Request, res: express.Response) => {
                            res.setHeader("Content-Type", "application/json");

                            try {
                                const workerResponse: RestEndpointExecuteResponse = await AwaitHelper.execute(
                                    workerInstance.execute(
                                        req.headers,
                                        `${req.protocol}://${req.get("host")}${req.originalUrl}`,
                                        req.body
                                    )
                                );

                                if (!IsHelper.isNullOrUndefined(workerResponse.response)) {
                                    res.status(workerResponse.status).json(workerResponse.response);
                                } else {
                                    res.status(workerResponse.status).send(true);
                                }
                            } catch (error) {
                                return res.status(500).render("500", {
                                    rootUrl: this.webRootUrl,
                                    error: serializeError(error),
                                });
                            }
                        }
                    );

                    global.omnihive.registeredUrls.push({
                        path: `${this.webRootUrl}${customRestSlug}${workerMetaData.urlRoute}`,
                        type: RegisteredUrlType.RestFunction,
                        metadata: {},
                    });

                    const workerSwagger: swaggerUi.JsonObject | undefined = workerInstance.getSwaggerDefinition();

                    if (!IsHelper.isNullOrUndefined(workerSwagger)) {
                        swaggerDefinition.paths = { ...swaggerDefinition.paths, ...workerSwagger.paths };
                        swaggerDefinition.definitions = {
                            ...swaggerDefinition.definitions,
                            ...workerSwagger.definitions,
                        };
                    }
                });

                if (swagger && !IsHelper.isEmptyArray(restWorkers)) {
                    app.get(
                        `${customRestSlug}/api-docs/swagger.json`,
                        async (_req: express.Request, res: express.Response) => {
                            res.setHeader("Content-Type", "application/json");
                            return res.status(200).json(swaggerDefinition);
                        }
                    );

                    app.use(`${customRestSlug}/api-docs`, swaggerUi.serve, swaggerUi.setup(swaggerDefinition));

                    global.omnihive.registeredUrls.push({
                        path: `${this.webRootUrl}${customRestSlug}/api-docs`,
                        type: RegisteredUrlType.Swagger,
                        metadata: {
                            swaggerJsonUrl: `${this.webRootUrl}${customRestSlug}/api-docs/swagger.json`,
                        },
                    });
                }
            }

            logWorker?.write(OmniHiveLogLevel.Info, `Master Web Process => REST Server Generation Completed`);

            app.get("/", (_req, res) => {
                res.status(200).render("index", {
                    rootUrl: this.webRootUrl,
                    status: global.omnihive.serverStatus,
                    registeredUrls: JSON.stringify(global.omnihive.registeredUrls),
                    serverError: JSON.stringify(global.omnihive.serverError),
                });
            });

            app.use((_req, res) => {
                return res.status(404).render("404", {
                    rootUrl: this.webRootUrl,
                });
            });

            app.use((err: any, _req: any, res: any, _next: any) => {
                return res.status(500).render("500", {
                    rootUrl: this.webRootUrl,
                    status: global.omnihive.serverStatus,
                    serverError: serializeError(err),
                });
            });

            global.omnihive.appServer = app;
            await AwaitHelper.execute(this.changeServerStatus(ServerStatus.Online));
        } catch (error) {
            // Problem...spin up admin server
            await AwaitHelper.execute(this.changeServerStatus(ServerStatus.Admin, error as Error));
            logWorker?.write(
                OmniHiveLogLevel.Error,
                `Server Spin-Up Error => ${JSON.stringify(serializeError(error))}`
            );
        }
    };

    public changeServerStatus = async (serverStatus: ServerStatus, error?: Error): Promise<void> => {
        if (
            IsHelper.isNullOrUndefinedOrEmptyStringOrWhitespace(this.webRootUrl) ||
            IsHelper.isNullOrUndefined(this.webPortNumber)
        ) {
            throw new Error("Web root url or port number is undefined");
        }

        const logWorker: ILogWorker | undefined = global.omnihive.getWorker<ILogWorker>(
            HiveWorkerType.Log,
            "__ohBootLogWorker"
        );

        logWorker?.write(OmniHiveLogLevel.Info, `Server Change Handler Started`);

        global.omnihive.serverStatus = serverStatus;

        if (!IsHelper.isNullOrUndefined(error)) {
            global.omnihive.serverError = serializeError(error);
        } else {
            global.omnihive.serverError = {};
        }

        if (serverStatus === ServerStatus.Admin || serverStatus === ServerStatus.Rebuilding) {
            const app: express.Express = await AwaitHelper.execute(this.getCleanAppServer());

            app.get("/", (_req, res) => {
                return res.status(200).render("index", {
                    rootUrl: this.webRootUrl,
                    registeredUrls: JSON.stringify(global.omnihive.registeredUrls),
                    status: global.omnihive.serverStatus,
                    error: JSON.stringify(global.omnihive.serverError),
                });
            });

            app.use((_req, res) => {
                return res.status(404).render("404", { rootUrl: this.webRootUrl });
            });

            app.use((err: any, _req: any, res: any, _next: any) => {
                return res.status(500).render("500", {
                    rootUrl: this.webRootUrl,
                    status: global.omnihive.serverStatus,
                    error: serializeError(err),
                });
            });

            global.omnihive.appServer?.removeAllListeners();
            global.omnihive.appServer = undefined;
            global.omnihive.appServer = app;
        }

        const server: Server = http.createServer(global.omnihive.appServer);
        global.omnihive.webServer?.removeAllListeners().close();
        global.omnihive.webServer = undefined;
        global.omnihive.webServer = server;

        global.omnihive.webServer?.listen(this.webPortNumber, () => {
            logWorker?.write(
                OmniHiveLogLevel.Info,
                `New Server Listening on process ${process.pid} using port ${this.webPortNumber}`
            );
        });

        global.omnihive.emitToNamespace(AdminRoomType.Command, AdminEventType.StatusResponse, {
            serverStatus: global.omnihive.serverStatus,
            serverError: global.omnihive.serverError,
        });

        logWorker?.write(OmniHiveLogLevel.Info, `Server Change Handler Completed`);

        const used = process.memoryUsage();
        logWorker?.write(
            OmniHiveLogLevel.Info,
            `Server Memory Usage => rss => ${Math.round((used.rss / 1024 / 1024) * 100) / 100} MB`
        );
        logWorker?.write(
            OmniHiveLogLevel.Info,
            `Server Memory Usage => external => ${Math.round((used.external / 1024 / 1024) * 100) / 100} MB`
        );
        logWorker?.write(
            OmniHiveLogLevel.Info,
            `Server Memory Usage => heapUsed => ${Math.round((used.heapUsed / 1024 / 1024) * 100) / 100} MB`
        );
        logWorker?.write(
            OmniHiveLogLevel.Info,
            `Server Memory Usage => heapTotal => ${Math.round((used.heapTotal / 1024 / 1024) * 100) / 100} MB`
        );
        logWorker?.write(OmniHiveLogLevel.Info, `Server Process Usage => listeners => ${process.listeners.length}`);
    };

    public getCleanAppServer = async (): Promise<express.Express> => {
        const webRootUrl = global.omnihive.getEnvironmentVariable<string>("OH_WEB_ROOT_URL");
        const webPortNumber = global.omnihive.getEnvironmentVariable<number>("OH_WEB_PORT_NUMBER");

        if (
            IsHelper.isNullOrUndefinedOrEmptyStringOrWhitespace(webRootUrl) ||
            IsHelper.isNullOrUndefined(webPortNumber)
        ) {
            throw new Error("Web root url or port number is undefined");
        }

        const logWorker: ILogWorker | undefined = global.omnihive.getWorker<ILogWorker>(
            HiveWorkerType.Log,
            "__ohBootLogWorker"
        );

        const adminRoot: string = `/ohAdmin`;

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

        app.use(express.urlencoded({ extended: true }));
        app.use(express.json());
        app.use(cors());

        // Setup View Engine
        app.set("view engine", "ejs");
        app.set("views", path.join(global.omnihive.ohDirName, `app`, `pages`));
        app.use("/public", express.static(path.join(global.omnihive.ohDirName, `app`, `public`)));

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
                    url: `${webRootUrl}${adminRoot}/rest`,
                },
            ],
            paths: {},
            definitions: {},
        };

        global.omnihive.registeredWorkers
            .filter(
                (rw: RegisteredHiveWorker) =>
                    rw.type === HiveWorkerType.RestEndpointFunction && rw.section === RegisteredHiveWorkerSection.Core
            )
            .forEach((rw: RegisteredHiveWorker) => {
                let workerMetaData: HiveWorkerMetadataRestFunction;

                try {
                    workerMetaData = ObjectHelper.createStrict<HiveWorkerMetadataRestFunction>(
                        HiveWorkerMetadataRestFunction,
                        rw.metadata
                    );
                } catch (error) {
                    logWorker?.write(
                        OmniHiveLogLevel.Error,
                        `Cannot register system REST worker ${rw.name}.  MetaData is incorrect.`
                    );

                    return;
                }

                const workerInstance: IRestEndpointWorker = rw.instance as IRestEndpointWorker;

                app[workerMetaData.restMethod](
                    `${adminRoot}/rest/${workerMetaData.urlRoute}`,
                    async (req: express.Request, res: express.Response) => {
                        res.setHeader("Content-Type", "application/json");

                        try {
                            const workerResponse: RestEndpointExecuteResponse = await AwaitHelper.execute(
                                workerInstance.execute(
                                    req.headers,
                                    `${req.protocol}://${req.get("host")}${req.originalUrl}`,
                                    req.body
                                )
                            );

                            if (!IsHelper.isNullOrUndefined(workerResponse.response)) {
                                res.status(workerResponse.status).json(workerResponse.response);
                            } else {
                                res.status(workerResponse.status).send(true);
                            }
                        } catch (error) {
                            return res.status(500).render("500", {
                                rootUrl: webRootUrl,
                                error: serializeError(error),
                            });
                        }
                    }
                );

                global.omnihive.registeredUrls.push({
                    path: `${webRootUrl}${adminRoot}/rest/${workerMetaData.urlRoute}`,
                    type: RegisteredUrlType.RestFunction,
                    metadata: {},
                });

                const workerSwagger: swaggerUi.JsonObject | undefined = workerInstance.getSwaggerDefinition();

                if (!IsHelper.isNullOrUndefined(workerSwagger)) {
                    swaggerDefinition.paths = { ...swaggerDefinition.paths, ...workerSwagger.paths };
                    swaggerDefinition.definitions = {
                        ...swaggerDefinition.definitions,
                        ...workerSwagger.definitions,
                    };
                }
            });

        app.get(`${adminRoot}/api-docs/swagger.json`, async (_req: express.Request, res: express.Response) => {
            res.setHeader("Content-Type", "application/json");
            return res.status(200).json(swaggerDefinition);
        });

        app.use(`${adminRoot}/api-docs`, swaggerUi.serve, swaggerUi.setup(swaggerDefinition));

        global.omnihive.registeredUrls.push({
            path: `${webRootUrl}${adminRoot}/api-docs`,
            type: RegisteredUrlType.Swagger,
            metadata: {
                swaggerJsonUrl: `${webRootUrl}${adminRoot}/api-docs/swagger.json`,
            },
        });

        return app;
    };

    private importFromString = (code: string): any => {
        const transformResult = transformSync(code, { format: "cjs" });
        const contextModule = new Module(nanoid());

        runInNewContext(transformResult.code, {
            exports: contextModule.exports,
            module: contextModule,
            require: contextModule.require,
        });

        return contextModule.exports;
    };
}
