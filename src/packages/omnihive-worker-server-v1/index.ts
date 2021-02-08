import { NodeServiceFactory } from "@withonevision/omnihive-core-node/factories/NodeServiceFactory";
import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { OmniHiveLogLevel } from "@withonevision/omnihive-core/enums/OmniHiveLogLevel";
import { ServerStatus } from "@withonevision/omnihive-core/enums/ServerStatus";
import { CoreServiceFactory } from "@withonevision/omnihive-core/factories/CoreServiceFactory";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { ObjectHelper } from "@withonevision/omnihive-core/helpers/ObjectHelper";
import { StringBuilder } from "@withonevision/omnihive-core/helpers/StringBuilder";
import { StringHelper } from "@withonevision/omnihive-core/helpers/StringHelper";
import { IDatabaseWorker } from "@withonevision/omnihive-core/interfaces/IDatabaseWorker";
import { IFeatureWorker } from "@withonevision/omnihive-core/interfaces/IFeatureWorker";
import { IGraphBuildWorker } from "@withonevision/omnihive-core/interfaces/IGraphBuildWorker";
import { ILogWorker } from "@withonevision/omnihive-core/interfaces/ILogWorker";
import { IRestEndpointWorker } from "@withonevision/omnihive-core/interfaces/IRestEndpointWorker";
import { IServerWorker } from "@withonevision/omnihive-core/interfaces/IServerWorker";
import { ConnectionSchema } from "@withonevision/omnihive-core/models/ConnectionSchema";
import { HiveWorker } from "@withonevision/omnihive-core/models/HiveWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-core/models/HiveWorkerBase";
import { HiveWorkerMetadataDatabase } from "@withonevision/omnihive-core/models/HiveWorkerMetadataDatabase";
import { HiveWorkerMetadataGraphBuilder } from "@withonevision/omnihive-core/models/HiveWorkerMetadataGraphBuilder";
import { HiveWorkerMetadataRestFunction } from "@withonevision/omnihive-core/models/HiveWorkerMetadataRestFunction";
import { HiveWorkerMetadataServer } from "@withonevision/omnihive-core/models/HiveWorkerMetadataServer";
import { OmniHiveConstants } from "@withonevision/omnihive-core/models/OmniHiveConstants";
import { StoredProcSchema } from "@withonevision/omnihive-core/models/StoredProcSchema";
import { TableSchema } from "@withonevision/omnihive-core/models/TableSchema";
import { ApolloServer, ApolloServerExpressConfig, mergeSchemas } from "apollo-server-express";
import { camelCase } from "change-case";
import express from "express";
import requireFromString from "require-from-string";
import { serializeError } from "serialize-error";
import swaggerUi from "swagger-ui-express";

export default class CoreServerWorker extends HiveWorkerBase implements IServerWorker {
    private metadata!: HiveWorkerMetadataServer;

    constructor() {
        super();
    }

    public async init(config: HiveWorker): Promise<void> {
        try {
            await AwaitHelper.execute<void>(super.init(config));
            this.metadata = this.checkObjectStructure<HiveWorkerMetadataServer>(
                HiveWorkerMetadataServer,
                config.metadata
            );
        } catch (err) {
            throw new Error("Redis Init Error => " + JSON.stringify(serializeError(err)));
        }
    }

    public buildServer = async (): Promise<void> => {
        const logWorker: ILogWorker | undefined = await CoreServiceFactory.workerService.getWorker<ILogWorker>(
            HiveWorkerType.Log,
            "ohreqLogWorker"
        );

        if (!logWorker) {
            throw new Error("Core Log Worker Not Found.  Server needs the core log worker ohreqLogWorker");
        }

        const featureWorker:
            | IFeatureWorker
            | undefined = await CoreServiceFactory.workerService.getWorker<IFeatureWorker>(HiveWorkerType.Feature);

        try {
            // Start setting up server
            const app = await NodeServiceFactory.appService.getCleanAppServer();

            logWorker.write(OmniHiveLogLevel.Info, `Graph Schema Folder Reset`);
            logWorker.write(OmniHiveLogLevel.Info, `Graph Connection Schemas Being Written`);

            // Get build workers
            const buildWorkers: [HiveWorker, any][] = [];

            CoreServiceFactory.workerService.registeredWorkers.forEach((worker: [HiveWorker, any]) => {
                if (
                    worker[0].type === HiveWorkerType.GraphBuilder &&
                    worker[0].enabled &&
                    (this.metadata.buildWorkers.includes("*") || this.metadata.buildWorkers.includes(worker[0].name))
                ) {
                    buildWorkers.push(worker);
                }
            });

            // Get db workers
            const dbWorkers: [HiveWorker, any, string][] = [];

            buildWorkers.forEach((worker: [HiveWorker, any]) => {
                const buildWorkerMetadata: HiveWorkerMetadataGraphBuilder = worker[0]
                    .metadata as HiveWorkerMetadataGraphBuilder;

                if (buildWorkerMetadata.dbWorkers.includes("*")) {
                    CoreServiceFactory.workerService.registeredWorkers
                        .filter(
                            (worker: [HiveWorker, any]) =>
                                worker[0].type === HiveWorkerType.Database && worker[0].enabled === true
                        )
                        .forEach((dbWorker: [HiveWorker, any]) => {
                            dbWorkers.push([dbWorker[0], dbWorker[1], worker[0].name]);
                        });
                } else {
                    buildWorkerMetadata.dbWorkers.forEach((value: string) => {
                        const dbWorker:
                            | [HiveWorker, any]
                            | undefined = CoreServiceFactory.workerService.registeredWorkers.find(
                            (worker: [HiveWorker, any]) =>
                                worker[0].name === value &&
                                worker[0].type === HiveWorkerType.Database &&
                                worker[0].enabled === true
                        );
                        if (dbWorker) {
                            dbWorkers.push([dbWorker[0], dbWorker[1], worker[0].name]);
                        }
                    });
                }
            });

            // Write database schemas

            for (const worker of dbWorkers) {
                logWorker.write(OmniHiveLogLevel.Info, `Retrieving ${worker[0].name} Schema`);

                const result: {
                    tables: TableSchema[];
                    storedProcs: StoredProcSchema[];
                } = await AwaitHelper.execute<{
                    tables: TableSchema[];
                    storedProcs: StoredProcSchema[];
                }>((worker[1] as IDatabaseWorker).getSchema());

                result.tables.forEach((schema: TableSchema) => {
                    schema.tableNameCamelCase = camelCase(schema.tableName);
                    schema.tableNamePascalCase = StringHelper.capitalizeFirstLetter(camelCase(schema.tableName));

                    if (schema.columnIsForeignKey) {
                        schema.columnForeignKeyTableNameCamelCase = camelCase(schema.columnForeignKeyTableName);
                        schema.columnForeignKeyTableNamePascalCase = StringHelper.capitalizeFirstLetter(
                            camelCase(schema.columnForeignKeyTableName)
                        );
                    }

                    let columnWorkingName = camelCase(schema.columnNameDatabase);

                    columnWorkingName = columnWorkingName.replace(/[^a-zA-Z0-9 ]+/g, "");
                    columnWorkingName = columnWorkingName.replace(/ /g, "_");
                    columnWorkingName = columnWorkingName.charAt(0).toLowerCase() + columnWorkingName.slice(1);

                    if (!isNaN(parseInt(schema.columnNameDatabase.substring(0, 1), 10))) {
                        columnWorkingName = "_N_" + columnWorkingName;
                    }

                    if (schema.columnNameDatabase.substring(0, 3) === "___") {
                        columnWorkingName = "_3_" + columnWorkingName;
                    } else if (schema.columnNameDatabase.substring(0, 2) === "__") {
                        columnWorkingName = "_2_" + columnWorkingName;
                    } else if (schema.columnNameDatabase.substring(0, 1) === "_") {
                        columnWorkingName = "_1_" + columnWorkingName;
                    }

                    schema.columnNameEntity = columnWorkingName.toString();
                });

                CoreServiceFactory.connectionService.registeredSchemas.push({
                    workerName: worker[0].name,
                    tables: result.tables,
                    storedProcs: result.storedProcs,
                });
            }

            logWorker.write(OmniHiveLogLevel.Info, `Graph Connection Schemas Completed`);
            logWorker.write(OmniHiveLogLevel.Info, `Writing Graph Generation Files`);

            // Get all build workers and write out their graph schema
            const dbWorkerModules: { workerName: string; dbModule: any }[] = [];

            for (const builder of buildWorkers) {
                const buildWorker: IGraphBuildWorker = builder[1] as IGraphBuildWorker;

                for (const dbWorker of dbWorkers.filter(
                    (worker: [HiveWorker, any, string]) => worker[2] === buildWorker.config.name
                )) {
                    const databaseWorker: IDatabaseWorker = dbWorker[1] as IDatabaseWorker;
                    const schema: ConnectionSchema | undefined = CoreServiceFactory.connectionService.getSchema(
                        dbWorker[0].name
                    );

                    const fileString = buildWorker.buildDatabaseWorkerSchema(databaseWorker, schema);
                    const dbWorkerModule = requireFromString(fileString);
                    dbWorkerModules.push({ workerName: dbWorker[0].name, dbModule: dbWorkerModule });
                }
            }

            // Build custom graph workers
            let graphEndpointModule: any | undefined = undefined;

            const customGraphWorkers: [HiveWorker, any][] = CoreServiceFactory.workerService.registeredWorkers.filter(
                (worker: [HiveWorker, any]) =>
                    worker[0].type === HiveWorkerType.GraphEndpointFunction && worker[0].enabled === true
            );
            if (customGraphWorkers.length > 0) {
                const builder: StringBuilder = new StringBuilder();

                // Build imports
                builder.appendLine(
                    `var { GraphQLInt, GraphQLSchema, GraphQLString, GraphQLBoolean, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLInputObjectType } = require("graphql");`
                );
                builder.appendLine(
                    `var { GraphQLJSONObject } = require("@withonevision/omnihive-core/models/GraphQLJSON");`
                );
                builder.appendLine(
                    `var { AwaitHelper } = require("@withonevision/omnihive-core/helpers/AwaitHelper");`
                );
                builder.appendLine(
                    `var { ITokenWorker } = require("@withonevision/omnihive-core/interfaces/ITokenWorker");`
                );
                builder.appendLine(
                    `var { HiveWorkerType } = require("@withonevision/omnihive-core/enums/HiveWorkerType");`
                );
                builder.appendLine(
                    `var { NodeServiceFactory } = require("@withonevision/omnihive-core-node/factories/NodeServiceFactory");`
                );
                builder.appendLine(
                    `var { CoreServiceFactory } = require("@withonevision/omnihive-core/factories/CoreServiceFactory");`
                );
                builder.appendLine();

                customGraphWorkers.forEach((worker: [HiveWorker, any]) => {
                    builder.appendLine(`var ${worker[0].name} = require("${worker[0].importPath}");`);
                });

                // Build main graph schema
                builder.appendLine(`exports.FederatedCustomFunctionQuerySchema = new GraphQLSchema({`);

                // Query Object Type
                builder.appendLine(`\tquery: new GraphQLObjectType({`);
                builder.appendLine(`\t\tname: 'Query',`);
                builder.appendLine(`\t\tfields: () => ({`);

                // Loop through graph endpoints

                customGraphWorkers.forEach((worker: [HiveWorker, any]) => {
                    builder.appendLine(`\t\t\t${worker[0].name}: {`);
                    builder.appendLine(`\t\t\t\ttype: GraphQLJSONObject,`);
                    builder.appendLine(`\t\t\t\targs: {`);
                    builder.appendLine(`\t\t\t\t\tcustomArgs: { type: GraphQLJSONObject },`);
                    builder.appendLine(`\t\t\t\t},`);
                    builder.appendLine(`\t\t\t\tresolve: async (parent, args, context, resolveInfo) => {`);
                    builder.appendLine(`\t\t\t\t\tvar customFunctionInstance = new ${worker[0].name}.default();`);
                    builder.appendLine(
                        `\t\t\t\t\tvar customFunctionReturn = await AwaitHelper.execute(customFunctionInstance.execute(args.customArgs));`
                    );
                    builder.appendLine(`\t\t\t\t\treturn customFunctionReturn;`);
                    builder.appendLine(`\t\t\t\t},`);
                    builder.appendLine(`\t\t\t},`);
                });

                builder.appendLine(`\t\t})`);
                builder.appendLine(`\t}),`);
                builder.appendLine(`});`);

                graphEndpointModule = requireFromString(builder.outputString());
            }

            logWorker.write(OmniHiveLogLevel.Info, `Graph Generation Files Completed`);
            logWorker.write(OmniHiveLogLevel.Info, `Graph Schema Build Completed Successfully`);
            logWorker.write(OmniHiveLogLevel.Info, `Booting Up Graph Server`);

            // Register graph builder databases
            logWorker.write(OmniHiveLogLevel.Info, `Graph Progress => Database Graph Endpoint Registering`);

            for (const builder of buildWorkers) {
                const builderMeta = builder[0].metadata as HiveWorkerMetadataGraphBuilder;

                const builderDbWorkers = dbWorkers.filter(
                    (worker: [HiveWorker, any, string]) => builder[0].name === worker[2]
                );

                if (builderDbWorkers.length > 0) {
                    for (const databaseWorker of builderDbWorkers) {
                        const dbWorkerMeta = databaseWorker[0].metadata as HiveWorkerMetadataDatabase;
                        let graphDatabaseSchema: any;

                        const databaseDynamicModule: any = dbWorkerModules.filter(
                            (value) => value.workerName === databaseWorker[0].name
                        )[0].dbModule;
                        const databaseQuerySchema: any = databaseDynamicModule.FederatedGraphQuerySchema;

                        // eslint-disable-next-line prefer-const
                        graphDatabaseSchema = databaseQuerySchema;

                        logWorker.write(
                            OmniHiveLogLevel.Info,
                            `Graph Progress => ${builder[0].name} => ${databaseWorker[0].name} Query Schema Merged`
                        );

                        const procSchema: any = databaseDynamicModule.FederatedGraphStoredProcSchema;

                        if (procSchema) {
                            graphDatabaseSchema = mergeSchemas({ schemas: [graphDatabaseSchema, procSchema] });
                        }

                        logWorker.write(
                            OmniHiveLogLevel.Info,
                            `Graph Progress => ${builder[0].name} => ${databaseWorker[0].name} Stored Proc Schema Merged`
                        );

                        const graphDatabaseConfig: ApolloServerExpressConfig = {
                            schema: graphDatabaseSchema,
                            tracing: (await featureWorker?.get<boolean>("graphTracing")) ?? true,
                            introspection: (await featureWorker?.get<boolean>("graphIntrospection")) ?? true,
                            context: async ({ req }) => {
                                const tokens = {
                                    access: req.headers.ohaccess || ``,
                                    auth: req.headers.authorization || ``,
                                    cache: req.headers.ohcache || ``,
                                    cacheSeconds: req.headers.ohcacheseconds,
                                };
                                return { tokens };
                            },
                        };

                        if ((await featureWorker?.get<boolean>("graphPlayground")) ?? true) {
                            graphDatabaseConfig.playground = {
                                endpoint: `${CoreServiceFactory.configurationService.settings.config.rootUrl}/graphql/database${builderMeta.graphUrl}/${dbWorkerMeta.graphEndpoint}`,
                            };
                        } else {
                            graphDatabaseConfig.playground = false;
                        }

                        const graphDatabaseServer: ApolloServer = new ApolloServer(graphDatabaseConfig);
                        graphDatabaseServer.applyMiddleware({
                            app,
                            path: `/graphql/database${builderMeta.graphUrl}/${dbWorkerMeta.graphEndpoint}`,
                        });
                    }
                }
            }

            logWorker.write(OmniHiveLogLevel.Info, `Graph Progress => Database Graph Endpoint Registered`);

            // Register custom graph apollo server
            logWorker.write(OmniHiveLogLevel.Info, `Graph Progress => Custom Functions Graph Endpoint Registering`);

            if (
                CoreServiceFactory.workerService.registeredWorkers.some(
                    (worker: [HiveWorker, any]) =>
                        worker[0].type === HiveWorkerType.GraphEndpointFunction && worker[0].enabled === true
                ) &&
                graphEndpointModule
            ) {
                const functionDynamicModule: any = graphEndpointModule;
                const graphFunctionSchema: any = functionDynamicModule.FederatedCustomFunctionQuerySchema;

                const graphFunctionConfig: ApolloServerExpressConfig = {
                    schema: graphFunctionSchema,
                    tracing: (await featureWorker?.get<boolean>("graphTracing")) ?? true,
                    introspection: (await featureWorker?.get<boolean>("graphIntrospection")) ?? true,
                    context: async ({ req }) => {
                        const tokens = {
                            access: req.headers.ohaccess || ``,
                            auth: req.headers.authorization || ``,
                            cache: req.headers.ohcache || ``,
                            cacheSeconds: req.headers.ohcacheseconds,
                        };
                        return { tokens };
                    },
                };

                if ((await featureWorker?.get<boolean>("graphPlayground")) ?? true) {
                    graphFunctionConfig.playground = {
                        endpoint: `${CoreServiceFactory.configurationService.settings.config.rootUrl}/graphql/custom`,
                    };
                } else {
                    graphFunctionConfig.playground = false;
                }

                const graphFunctionServer: ApolloServer = new ApolloServer(graphFunctionConfig);
                graphFunctionServer.applyMiddleware({ app, path: `/graphql/custom` });
            }

            logWorker.write(OmniHiveLogLevel.Info, `Graph Progress => Custom Functions Endpoint Registered`);
            logWorker.write(OmniHiveLogLevel.Info, `REST Server Generation Started`);

            // Register "custom" REST endpoints
            if (
                CoreServiceFactory.workerService.registeredWorkers.some(
                    (worker: [HiveWorker, any]) =>
                        worker[0].type === HiveWorkerType.RestEndpointFunction && worker[0].enabled === true
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
                            url: `${CoreServiceFactory.configurationService.settings.config.rootUrl}${OmniHiveConstants.CUSTOM_REST_ROOT}`,
                        },
                    ],
                };

                CoreServiceFactory.workerService.registeredWorkers
                    .filter(
                        (w: [HiveWorker, any]) =>
                            w[0].type === HiveWorkerType.RestEndpointFunction && w[0].enabled === true
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
                                `Cannot register custom REST worker ${w[0].name}.  MetaData is incorrect.`
                            );

                            return;
                        }

                        if (workerMetaData.isSystem) {
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

                if ((await featureWorker?.get<boolean>("swagger")) ?? true) {
                    app.use(
                        `${OmniHiveConstants.CUSTOM_REST_ROOT}/api-docs`,
                        swaggerUi.serve,
                        swaggerUi.setup(swaggerDefinition)
                    );
                }
            }

            logWorker.write(OmniHiveLogLevel.Info, `REST Server Generation Completed`);
            NodeServiceFactory.appService.serverStatus = ServerStatus.Online;

            app.get("/", (_req, res) => {
                res.setHeader("Content-Type", "application/json");
                return res.status(200).json({
                    status: NodeServiceFactory.appService.serverStatus,
                    error: NodeServiceFactory.appService.serverError,
                });
            });

            logWorker.write(OmniHiveLogLevel.Info, `New Server Built`);

            // Rebuild server
            NodeServiceFactory.appService.appServer = app;
        } catch (err) {
            logWorker.write(OmniHiveLogLevel.Error, `Server Spin-Up Error => ${JSON.stringify(serializeError(err))}`);
            throw new Error(err);
        }
    };
}
