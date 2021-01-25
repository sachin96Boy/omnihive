import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { OmniHiveLogLevel } from "@withonevision/omnihive-core/enums/OmniHiveLogLevel";
import { ServerStatus } from "@withonevision/omnihive-core/enums/ServerStatus";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { ObjectHelper } from "@withonevision/omnihive-core/helpers/ObjectHelper";
import { StringBuilder } from "@withonevision/omnihive-core/helpers/StringBuilder";
import { StringHelper } from "@withonevision/omnihive-core/helpers/StringHelper";
import { IDatabaseWorker } from "@withonevision/omnihive-core/interfaces/IDatabaseWorker";
import { IFileSystemWorker } from "@withonevision/omnihive-core/interfaces/IFileSystemWorker";
import { IGraphBuildWorker } from "@withonevision/omnihive-core/interfaces/IGraphBuildWorker";
import { ILogWorker } from "@withonevision/omnihive-core/interfaces/ILogWorker";
import { IPubSubClientWorker } from "@withonevision/omnihive-core/interfaces/IPubSubClientWorker";
import { IPubSubServerWorker } from "@withonevision/omnihive-core/interfaces/IPubSubServerWorker";
import { IRestEndpointWorker } from "@withonevision/omnihive-core/interfaces/IRestEndpointWorker";
import { HiveWorker } from "@withonevision/omnihive-core/models/HiveWorker";
import { HiveWorkerMetadataGraphBuilder } from "@withonevision/omnihive-core/models/HiveWorkerMetadataGraphBuilder";
import { HiveWorkerMetadataRestFunction } from "@withonevision/omnihive-core/models/HiveWorkerMetadataRestFunction";
import { OmniHiveConstants } from "@withonevision/omnihive-core/models/OmniHiveConstants";
import { RegisteredInstance } from "@withonevision/omnihive-core/models/RegisteredInstance";
import { ServerSettings } from "@withonevision/omnihive-core/models/ServerSettings";
import { StoredProcSchema } from "@withonevision/omnihive-core/models/StoredProcSchema";
import { TableSchema } from "@withonevision/omnihive-core/models/TableSchema";
import { CommonStore } from "@withonevision/omnihive-core/stores/CommonStore";
import { ApolloServer, ApolloServerExpressConfig, mergeSchemas } from "apollo-server-express";
import { camelCase } from "change-case";
import express from "express";
import os from "os";
import { serializeError } from "serialize-error";
import swaggerUi from "swagger-ui-express";
import { OmniHiveStore } from "../stores/OmniHiveStore";
import { AppService } from "./AppService";
import { InstanceService } from "./InstanceService";

export class ServerService {
    public start = async (name: string | undefined, settings: string | undefined): Promise<void> => {
        const instanceService: InstanceService = new InstanceService();

        if (name && settings) {
            throw new Error(
                "You cannot start the server with a named instance and a settings location.  You must choose one or the other."
            );
        }

        // Check for latest instance

        if (!name && !settings) {
            const latestInstance: RegisteredInstance | undefined = instanceService.getLatest();

            if (!latestInstance) {
                throw new Error("No name and no settings given...but also cannot find latest instance");
            }

            name = latestInstance.name;
        }

        // Check instance name
        if (name) {
            const instance: RegisteredInstance | undefined = instanceService.get(name);

            if (instance) {
                instanceService.setLatestInstance(name);
            } else {
                throw new Error("Instance name provided has not been set or does not exist");
            }
        }

        // Run basic app service
        const appService: AppService = new AppService();
        const appSettings: ServerSettings = appService.getServerSettings(name, settings);
        await appService.initApp(appSettings);

        // Intialize "backbone" hive workers

        const logWorker: ILogWorker | undefined = await CommonStore.getInstance().getHiveWorker<ILogWorker>(
            HiveWorkerType.Log,
            "ohreqLogWorker"
        );

        if (!logWorker) {
            throw new Error("Core Log Worker Not Found.  Server needs the core log worker ohreqLogWorker");
        }

        const adminPubSubServerWorkerName: string | undefined = CommonStore.getInstance().settings.constants[
            "adminPubSubServerWorkerInstance"
        ];

        const adminPubSubServer: IPubSubServerWorker | undefined = await AwaitHelper.execute<
            IPubSubServerWorker | undefined
        >(
            CommonStore.getInstance().getHiveWorker<IPubSubServerWorker>(
                HiveWorkerType.PubSubServer,
                adminPubSubServerWorkerName
            )
        );

        const adminPubSubClientWorkerName: string | undefined = CommonStore.getInstance().settings.constants[
            "adminPubSubClientWorkerInstance"
        ];

        const adminPubSubClient: IPubSubClientWorker | undefined = await AwaitHelper.execute<
            IPubSubClientWorker | undefined
        >(
            CommonStore.getInstance().getHiveWorker<IPubSubClientWorker>(
                HiveWorkerType.PubSubClient,
                adminPubSubClientWorkerName
            )
        );

        adminPubSubClient?.joinChannel(CommonStore.getInstance().settings.config.serverGroupName);

        adminPubSubClient?.addListener(
            CommonStore.getInstance().settings.config.serverGroupName,
            "server-reset-request",
            (data: { reset: boolean }) => {
                if (!data || !data.reset) {
                    return;
                }

                OmniHiveStore.getInstance()
                    .loadSpecialStatusApp(ServerStatus.Rebuilding)
                    .then(() => {
                        OmniHiveStore.getInstance().serverChangeHandler();

                        try {
                            this.buildServer()
                                .then(() => {
                                    OmniHiveStore.getInstance().serverChangeHandler();

                                    logWorker.write(OmniHiveLogLevel.Info, `Server Spin-Up Complete => Online `);
                                    adminPubSubServer?.emit(
                                        CommonStore.getInstance().settings.config.serverGroupName,
                                        "server-reset-result",
                                        {
                                            serverName: os.hostname(),
                                            success: true,
                                            error: "",
                                        }
                                    );
                                })
                                .catch((err: Error) => {
                                    OmniHiveStore.getInstance().loadSpecialStatusApp(ServerStatus.Admin, err);

                                    OmniHiveStore.getInstance().serverChangeHandler();

                                    logWorker.write(
                                        OmniHiveLogLevel.Error,
                                        `Server Spin-Up Error => ${JSON.stringify(serializeError(err))}`
                                    );
                                    adminPubSubServer?.emit(
                                        CommonStore.getInstance().settings.config.serverGroupName,
                                        "server-reset-result",
                                        {
                                            serverName: os.hostname(),
                                            success: false,
                                            error: JSON.stringify(serializeError(err)),
                                        }
                                    );
                                });
                        } catch (err) {
                            OmniHiveStore.getInstance().loadSpecialStatusApp(ServerStatus.Admin, err);

                            OmniHiveStore.getInstance().serverChangeHandler();

                            logWorker.write(
                                OmniHiveLogLevel.Error,
                                `Server Spin-Up Error => ${JSON.stringify(serializeError(err))}`
                            );
                            adminPubSubServer?.emit(
                                CommonStore.getInstance().settings.config.serverGroupName,
                                "server-reset-result",
                                {
                                    serverName: os.hostname(),
                                    success: false,
                                    error: JSON.stringify(serializeError(err)),
                                }
                            );
                        }
                    });
            }
        );

        // Set server to rebuilding first
        await AwaitHelper.execute<void>(OmniHiveStore.getInstance().loadSpecialStatusApp(ServerStatus.Rebuilding));
        OmniHiveStore.getInstance().serverChangeHandler();

        // Try to spin up full server
        try {
            await AwaitHelper.execute<void>(this.buildServer());
            CommonStore.getInstance().changeSystemStatus(ServerStatus.Online);
            OmniHiveStore.getInstance().serverChangeHandler();
        } catch (err) {
            // Problem...spin up admin server
            OmniHiveStore.getInstance().loadSpecialStatusApp(ServerStatus.Admin, err);
            OmniHiveStore.getInstance().serverChangeHandler();
            logWorker.write(OmniHiveLogLevel.Error, `Server Spin-Up Error => ${JSON.stringify(serializeError(err))}`);
        }
    };

    private buildServer = async (): Promise<void> => {
        const fileSystemWorker:
            | IFileSystemWorker
            | undefined = await CommonStore.getInstance().getHiveWorker<IFileSystemWorker>(
            HiveWorkerType.FileSystem,
            "ohreqFileSystemWorker"
        );

        if (!fileSystemWorker) {
            throw new Error(
                "Core FileSystem Worker Not Found.  Server needs the core log worker ohreqFileSystemWorker"
            );
        }

        const logWorker: ILogWorker | undefined = await CommonStore.getInstance().getHiveWorker<ILogWorker>(
            HiveWorkerType.Log,
            "ohreqLogWorker"
        );

        if (!logWorker) {
            throw new Error("Core Log Worker Not Found.  Server needs the core log worker ohreqLogWorker");
        }

        try {
            // Start setting up server
            const app = await OmniHiveStore.getInstance().getCleanAppServer();

            // Clear schema directories
            fileSystemWorker.ensureFolderExists(
                `${fileSystemWorker.getCurrentExecutionDirectory()}/${OmniHiveConstants.SERVER_OUTPUT_DIRECTORY}`
            );

            fileSystemWorker.ensureFolderExists(
                `${fileSystemWorker.getCurrentExecutionDirectory()}/${
                    OmniHiveConstants.SERVER_OUTPUT_DIRECTORY
                }/connections`
            );
            fileSystemWorker.removeFilesFromDirectory(
                `${fileSystemWorker.getCurrentExecutionDirectory()}/${
                    OmniHiveConstants.SERVER_OUTPUT_DIRECTORY
                }/connections`
            );

            fileSystemWorker.ensureFolderExists(
                `${fileSystemWorker.getCurrentExecutionDirectory()}/${
                    OmniHiveConstants.SERVER_OUTPUT_DIRECTORY
                }/graphql`
            );
            fileSystemWorker.removeFilesFromDirectory(
                `${fileSystemWorker.getCurrentExecutionDirectory()}/${
                    OmniHiveConstants.SERVER_OUTPUT_DIRECTORY
                }/graphql`
            );

            logWorker.write(OmniHiveLogLevel.Info, `Graph Schema Folder Reset`);
            logWorker.write(OmniHiveLogLevel.Info, `Graph Connection Schemas Being Written`);

            // Get build workers
            const buildWorkers: [HiveWorker, any][] = CommonStore.getInstance().workers.filter(
                (worker: [HiveWorker, any]) =>
                    worker[0].type === HiveWorkerType.GraphBuilder && worker[0].enabled === true
            );

            // Get db workers
            const dbWorkers: [HiveWorker, any, string][] = [];

            buildWorkers.forEach((worker: [HiveWorker, any]) => {
                const buildWorkerMetadata: HiveWorkerMetadataGraphBuilder = worker[0]
                    .metadata as HiveWorkerMetadataGraphBuilder;

                if (buildWorkerMetadata.dbWorkers.includes("*")) {
                    CommonStore.getInstance()
                        .workers.filter(
                            (worker: [HiveWorker, any]) =>
                                worker[0].type === HiveWorkerType.Database && worker[0].enabled === true
                        )
                        .forEach((dbWorker: [HiveWorker, any]) => {
                            dbWorkers.push([dbWorker[0], dbWorker[1], worker[0].name]);
                        });
                } else {
                    buildWorkerMetadata.dbWorkers.forEach((value: string) => {
                        const dbWorker: [HiveWorker, any] | undefined = CommonStore.getInstance().workers.find(
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
                logWorker.write(OmniHiveLogLevel.Info, `Writing ${worker[0].name} Schema`);

                const path: string = `${fileSystemWorker.getCurrentExecutionDirectory()}/${
                    OmniHiveConstants.SERVER_OUTPUT_DIRECTORY
                }/connections/${worker[0].name}.json`;
                console.log("Config service waiting on schema");

                const result: { tables: TableSchema[]; storedProcs: StoredProcSchema[] } = await AwaitHelper.execute<{
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

                fileSystemWorker.writeJsonToFile(path, result);
            }

            logWorker.write(OmniHiveLogLevel.Info, `Graph Connection Schemas Completed`);
            logWorker.write(OmniHiveLogLevel.Info, `Writing Graph Generation Files`);

            // Get all build workers and write out their graph schema

            for (const builder of buildWorkers) {
                const buildWorker: IGraphBuildWorker = builder[1] as IGraphBuildWorker;

                dbWorkers
                    .filter((worker: [HiveWorker, any, string]) => worker[2] === buildWorker.config.name)
                    .forEach((dbWorker: [HiveWorker, any, string]) => {
                        const databaseWorker: IDatabaseWorker = dbWorker[1] as IDatabaseWorker;

                        const schemaFilePath: string = `${fileSystemWorker.getCurrentExecutionDirectory()}/${
                            OmniHiveConstants.SERVER_OUTPUT_DIRECTORY
                        }/connections/${dbWorker[0].name}.json`;
                        const jsonSchema: any = JSON.parse(fileSystemWorker.readFile(schemaFilePath));

                        const fileString = buildWorker.buildDatabaseWorkerSchema(databaseWorker, {
                            tables: jsonSchema["tables"],
                            storedProcs: jsonSchema["storedProcs"],
                        });
                        const masterPath: string = `${fileSystemWorker.getCurrentExecutionDirectory()}/${
                            OmniHiveConstants.SERVER_OUTPUT_DIRECTORY
                        }/graphql/${buildWorker.config.name}_${dbWorker[0].name}_FederatedGraphSchema.js`;
                        fileSystemWorker.writeDataToFile(masterPath, fileString);
                    });
            }

            // Build custom graph workers
            const customGraphWorkers: [HiveWorker, any][] = CommonStore.getInstance().workers.filter(
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
                builder.appendLine(`var { CommonStore } = require("@withonevision/omnihive-core/stores/CommonStore");`);
                builder.appendLine();

                customGraphWorkers.forEach((worker: [HiveWorker, any]) => {
                    builder.appendLine(`var ${worker[0].name} = require("${worker[0].classPath}");`);
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
                    builder.appendLine(
                        `\t\t\t\t\tvar customFunctionReturn = await AwaitHelper.execute(${worker[0].name}(parent, args, context, resolveInfo));`
                    );
                    builder.appendLine(`\t\t\t\t\treturn customFunctionReturn;`);
                    builder.appendLine(`\t\t\t\t},`);
                    builder.appendLine(`\t\t\t},`);
                });

                builder.appendLine(`\t\t})`);
                builder.appendLine(`\t}),`);
                builder.appendLine(`});`);

                const functionPath: string = `${fileSystemWorker.getCurrentExecutionDirectory()}/${
                    OmniHiveConstants.SERVER_OUTPUT_DIRECTORY
                }/graphql/CustomFunctionFederatedGraphSchema.js`;
                fileSystemWorker.writeDataToFile(functionPath, builder.outputString());
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
                    let graphDatabaseSchema: any;

                    let databaseWorkerIndex: number = 0;

                    for (const databaseWorker of builderDbWorkers) {
                        const databaseFileName: string = `${fileSystemWorker.getCurrentExecutionDirectory()}/${
                            OmniHiveConstants.SERVER_OUTPUT_DIRECTORY
                        }/graphql/${builder[0].name}_${databaseWorker[0].name}_FederatedGraphSchema.js`;
                        const databaseDynamicModule: any = await import(databaseFileName);
                        const databaseQuerySchema: any = databaseDynamicModule.FederatedGraphQuerySchema;

                        if (databaseWorkerIndex === 0) {
                            graphDatabaseSchema = databaseQuerySchema;
                        } else {
                            graphDatabaseSchema = mergeSchemas({ schemas: [graphDatabaseSchema, databaseQuerySchema] });
                        }

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

                        databaseWorkerIndex++;
                    }

                    const graphDatabaseConfig: ApolloServerExpressConfig = {
                        schema: graphDatabaseSchema,
                        tracing: CommonStore.getInstance().settings.config.developerMode,
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

                    if (CommonStore.getInstance().settings.config.enableGraphPlayground) {
                        graphDatabaseConfig.introspection = true;
                        graphDatabaseConfig.playground = {
                            endpoint: `${CommonStore.getInstance().settings.config.rootUrl}/graphql/database${
                                builderMeta.graphUrl
                            }`,
                        };
                    } else {
                        graphDatabaseConfig.introspection = false;
                        graphDatabaseConfig.playground = false;
                    }

                    const graphDatabaseServer: ApolloServer = new ApolloServer(graphDatabaseConfig);
                    graphDatabaseServer.applyMiddleware({ app, path: `/graphql/database${builderMeta.graphUrl}` });
                }
            }

            logWorker.write(OmniHiveLogLevel.Info, `Graph Progress => Database Graph Endpoint Registered`);

            // Register custom graph apollo server
            logWorker.write(OmniHiveLogLevel.Info, `Graph Progress => Custom Functions Graph Endpoint Registering`);

            if (
                CommonStore.getInstance().workers.some(
                    (worker: [HiveWorker, any]) =>
                        worker[0].type === HiveWorkerType.GraphEndpointFunction && worker[0].enabled === true
                )
            ) {
                const functionFileName: string = `${fileSystemWorker.getCurrentExecutionDirectory()}/${
                    OmniHiveConstants.SERVER_OUTPUT_DIRECTORY
                }/graphql/CustomFunctionFederatedGraphSchema.js`;
                const functionDynamicModule: any = await import(functionFileName);
                const graphFunctionSchema: any = functionDynamicModule.FederatedCustomFunctionQuerySchema;

                const graphFunctionConfig: ApolloServerExpressConfig = {
                    schema: graphFunctionSchema,
                    tracing: CommonStore.getInstance().settings.config.developerMode,
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

                if (CommonStore.getInstance().settings.config.enableGraphPlayground) {
                    graphFunctionConfig.introspection = true;
                    graphFunctionConfig.playground = {
                        endpoint: `${CommonStore.getInstance().settings.config.rootUrl}/graphql/custom`,
                    };
                } else {
                    graphFunctionConfig.introspection = false;
                    graphFunctionConfig.playground = false;
                }

                const graphFunctionServer: ApolloServer = new ApolloServer(graphFunctionConfig);
                graphFunctionServer.applyMiddleware({ app, path: `/graphql/custom` });
            }

            logWorker.write(OmniHiveLogLevel.Info, `Graph Progress => Custom Functions Endpoint Registered`);
            logWorker.write(OmniHiveLogLevel.Info, `REST Server Generation Started`);

            // Register "custom" REST endpoints
            if (
                CommonStore.getInstance().workers.some(
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
                            url: `${CommonStore.getInstance().settings.config.rootUrl}${
                                OmniHiveConstants.CUSTOM_REST_ROOT
                            }`,
                        },
                    ],
                };

                CommonStore.getInstance()
                    .workers.filter(
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

                if (CommonStore.getInstance().settings.config.enableSwagger) {
                    app.use(
                        `${OmniHiveConstants.CUSTOM_REST_ROOT}/api-docs`,
                        swaggerUi.serve,
                        swaggerUi.setup(swaggerDefinition)
                    );
                }
            }

            logWorker.write(OmniHiveLogLevel.Info, `REST Server Generation Completed`);
            CommonStore.getInstance().changeSystemStatus(ServerStatus.Online);

            app.get("/", (_req, res) => {
                res.setHeader("Content-Type", "application/json");
                return res.status(200).json(CommonStore.getInstance().status);
            });

            logWorker.write(OmniHiveLogLevel.Info, `New Server Built`);

            // Rebuild server
            OmniHiveStore.getInstance().appServer = app;
        } catch (err) {
            logWorker.write(OmniHiveLogLevel.Error, `Server Spin-Up Error => ${JSON.stringify(serializeError(err))}`);
            throw new Error(err);
        }
    };
}
