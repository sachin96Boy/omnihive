import { HiveWorkerType } from "@withonevision/omnihive-hive-common/enums/HiveWorkerType";
import { OmniHiveLogLevel } from "@withonevision/omnihive-hive-common/enums/OmniHiveLogLevel";
import { ServerStatus } from "@withonevision/omnihive-hive-common/enums/ServerStatus";
import { AwaitHelper } from "@withonevision/omnihive-hive-common/helpers/AwaitHelper";
import { StringBuilder } from "@withonevision/omnihive-hive-common/helpers/StringBuilder";
import { StringHelper } from "@withonevision/omnihive-hive-common/helpers/StringHelper";
import { HiveWorker } from "@withonevision/omnihive-hive-common/models/HiveWorker";
import { OmniHiveConstants } from "@withonevision/omnihive-hive-common/models/OmniHiveConstants";
import { StoredProcSchema } from "@withonevision/omnihive-hive-common/models/StoredProcSchema";
import { TableSchema } from "@withonevision/omnihive-hive-common/models/TableSchema";
import { QueenStore } from "@withonevision/omnihive-hive-queen/stores/QueenStore";
import { HiveWorkerFactory } from "@withonevision/omnihive-hive-worker/HiveWorkerFactory";
import { IDatabaseWorker } from "@withonevision/omnihive-hive-worker/interfaces/IDatabaseWorker";
import { IFileSystemWorker } from "@withonevision/omnihive-hive-worker/interfaces/IFileSystemWorker";
import { IGraphBuildWorker } from "@withonevision/omnihive-hive-worker/interfaces/IGraphBuildWorker";
import { ILogWorker } from "@withonevision/omnihive-hive-worker/interfaces/ILogWorker";
import { IRestEndpointWorker } from "@withonevision/omnihive-hive-worker/interfaces/IRestEndpointWorker";
import { IServerWorker } from "@withonevision/omnihive-hive-worker/interfaces/IServerWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-hive-worker/models/HiveWorkerBase";
import { HiveWorkerMetadataGraphBuilder } from "@withonevision/omnihive-hive-worker/models/HiveWorkerMetadataGraphBuilder";
import { HiveWorkerMetadataServer } from "@withonevision/omnihive-hive-worker/models/HiveWorkerMetadataServer";
import { ServerStore } from "@withonevision/omnihive-public-server/stores/ServerStore";
import { ApolloServer, ApolloServerExpressConfig, mergeSchemas } from "apollo-server-express";
import { camelCase } from "change-case";
import { serializeError } from "serialize-error";
import swaggerUi from "swagger-ui-express";

export default class ServerWorker extends HiveWorkerBase implements IServerWorker {

    private metadata!: HiveWorkerMetadataServer;
    private fileSystemWorker!: IFileSystemWorker;
    private logWorker!: ILogWorker;

    constructor() {
        super();
    }

    public async init(config: HiveWorker): Promise<void> {

        await AwaitHelper.execute<void>(super.init(config));
        this.metadata = this.checkMetadata<HiveWorkerMetadataServer>(HiveWorkerMetadataServer, config.metadata);
    }

    public async afterInit(): Promise<void> {
        const fileSystemWorker: IFileSystemWorker | undefined = await HiveWorkerFactory.getInstance().getHiveWorker<IFileSystemWorker>(HiveWorkerType.FileSystem);

        if (!fileSystemWorker) {
            throw new Error("FileSystem Worker Not Found.  Server must be able to read from the filesystem");
        }

        this.fileSystemWorker = fileSystemWorker;

        const logWorker: ILogWorker | undefined = await HiveWorkerFactory.getInstance().getHiveWorker<ILogWorker>(HiveWorkerType.Log, "ohreqLogWorker");

        if (!logWorker) {
            throw new Error("Core Log Worker Not Found.  Server needs the core log worker ohreqLogWorker");
        }

        this.logWorker = logWorker;
    }

    public buildServer = async (): Promise<void> => {

        try {

            // Start setting up server
            const app = ServerStore.getInstance().getCleanAppServer();

            // Clear schema directories
            this.fileSystemWorker.ensureFolderExists(`${this.fileSystemWorker.getCurrentExecutionDirectory()}/${OmniHiveConstants.SERVER_OUTPUT_DIRECTORY}`);

            this.fileSystemWorker.ensureFolderExists(`${this.fileSystemWorker.getCurrentExecutionDirectory()}/${OmniHiveConstants.SERVER_OUTPUT_DIRECTORY}/connections`);
            this.fileSystemWorker.removeFilesFromDirectory(`${this.fileSystemWorker.getCurrentExecutionDirectory()}/${OmniHiveConstants.SERVER_OUTPUT_DIRECTORY}/connections`);

            this.fileSystemWorker.ensureFolderExists(`${this.fileSystemWorker.getCurrentExecutionDirectory()}/${OmniHiveConstants.SERVER_OUTPUT_DIRECTORY}/graphql`);
            this.fileSystemWorker.removeFilesFromDirectory(`${this.fileSystemWorker.getCurrentExecutionDirectory()}/${OmniHiveConstants.SERVER_OUTPUT_DIRECTORY}/graphql`);

            this.logWorker.write(OmniHiveLogLevel.Info, `Graph Schema Folder Reset`);
            this.logWorker.write(OmniHiveLogLevel.Info, `Graph Connection Schemas Being Written`);

            // Get build workers
            const buildWorkers: [HiveWorker, any][] = HiveWorkerFactory.getInstance().workers.filter((worker: [HiveWorker, any]) =>
                worker[0].type === HiveWorkerType.GraphBuilder && worker[0].enabled === true &&
                (this.metadata.buildWorkers.includes(worker[0].name) || this.metadata.buildWorkers.includes("*")));

            // Get db workers
            const dbWorkers: [HiveWorker, any, string][] = [];

            buildWorkers.forEach((worker: [HiveWorker, any]) => {
                const buildWorkerMetadata: HiveWorkerMetadataGraphBuilder = worker[0].metadata as HiveWorkerMetadataGraphBuilder;

                if (buildWorkerMetadata.dbWorkers.includes("*")) {
                    HiveWorkerFactory.getInstance().workers.filter((worker: [HiveWorker, any]) => worker[0].type === HiveWorkerType.Database && worker[0].enabled === true)
                        .forEach((dbWorker: [HiveWorker, any]) => {
                            dbWorkers.push([dbWorker[0], dbWorker[1], worker[0].name]);
                        });
                } else {
                    buildWorkerMetadata.dbWorkers.forEach((value: string) => {
                        const dbWorker: [HiveWorker, any] | undefined = HiveWorkerFactory.getInstance().workers
                            .find((worker: [HiveWorker, any]) => worker[0].name === value && worker[0].type === HiveWorkerType.Database && worker[0].enabled === true)
                        if (dbWorker) {
                            dbWorkers.push([dbWorker[0], dbWorker[1], worker[0].name]);
                        }
                    });
                }
            });

            // Write database schemas
            for (const worker of dbWorkers) {

                this.logWorker.write(OmniHiveLogLevel.Info, `Writing ${worker[0].name} Schema`);

                const path: string = `${this.fileSystemWorker.getCurrentExecutionDirectory()}/${OmniHiveConstants.SERVER_OUTPUT_DIRECTORY}/connections/${worker[0].name}.json`;
                console.log("Config service waiting on schema");

                const result: { tables: TableSchema[], storedProcs: StoredProcSchema[] } =
                    await AwaitHelper.execute<{ tables: TableSchema[], storedProcs: StoredProcSchema[] }>((worker[1] as IDatabaseWorker).getSchema());

                result.tables.forEach((schema: TableSchema) => {
                    schema.tableNameCamelCase = camelCase(schema.tableName);
                    schema.tableNamePascalCase = StringHelper.capitalizeFirstLetter(camelCase(schema.tableName));

                    if (schema.columnIsForeignKey) {
                        schema.columnForeignKeyTableNameCamelCase = camelCase(schema.columnForeignKeyTableName);
                        schema.columnForeignKeyTableNamePascalCase = StringHelper.capitalizeFirstLetter(camelCase(schema.columnForeignKeyTableName));
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

                this.fileSystemWorker.writeJsonToFile(path, result);
            }

            this.logWorker.write(OmniHiveLogLevel.Info, `Graph Connection Schemas Completed`);
            this.logWorker.write(OmniHiveLogLevel.Info, `Writing Graph Generation Files`);

            // Get all build workers and write out their graph schema

            for (const builder of buildWorkers) {

                const buildWorker: IGraphBuildWorker = builder[1] as IGraphBuildWorker;

                dbWorkers
                    .filter((worker: [HiveWorker, any, string]) => worker[2] === buildWorker.config.name)
                    .forEach((dbWorker: [HiveWorker, any, string]) => {
                        const databaseWorker: IDatabaseWorker = dbWorker[1] as IDatabaseWorker;

                        const schemaFilePath: string = `${this.fileSystemWorker.getCurrentExecutionDirectory()}/${OmniHiveConstants.SERVER_OUTPUT_DIRECTORY}/connections/${dbWorker[0].name}.json`;
                        const jsonSchema: any = JSON.parse(this.fileSystemWorker.readFile(schemaFilePath));

                        const fileString = buildWorker.buildDatabaseWorkerSchema(databaseWorker, { tables: jsonSchema["tables"], storedProcs: jsonSchema["storedProcs"] });
                        const masterPath: string = `${this.fileSystemWorker.getCurrentExecutionDirectory()}/${OmniHiveConstants.SERVER_OUTPUT_DIRECTORY}/graphql/${buildWorker.config.name}_${dbWorker[0].name}_FederatedGraphSchema.js`;
                        this.fileSystemWorker.writeDataToFile(masterPath, fileString);
                    });
            }

            // Build custom graph workers
            const customGraphWorkers: [HiveWorker, any][] = HiveWorkerFactory.getInstance().workers.filter((worker: [HiveWorker, any]) => worker[0].type === HiveWorkerType.GraphEndpointFunction && worker[0].enabled === true)
            if (customGraphWorkers.length > 0) {

                const builder: StringBuilder = new StringBuilder();

                // Build imports
                builder.appendLine(`var { GraphQLInt, GraphQLSchema, GraphQLString, GraphQLBoolean, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLInputObjectType } = require("graphql");`);
                builder.appendLine(`var { GraphQLJSONObject } = require("@withonevision/omnihive-hive-common/models/GraphQLJSON");`);
                builder.appendLine(`var { AwaitHelper } = require("@withonevision/omnihive-hive-common/helpers/AwaitHelper");`);
                builder.appendLine(`var { ITokenWorker } = require("@withonevision/omnihive-hive-worker/interfaces/ITokenWorker");`);
                builder.appendLine(`var { HiveWorkerType } = require("@withonevision/omnihive-hive-common/enums/HiveWorkerType");`);
                builder.appendLine(`var { HiveWorkerFactory } = require("@withonevision/omnihive-hive-worker/HiveWorkerFactory");`);
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
                    builder.appendLine(`\t\t\t\t\tvar customFunctionReturn = await AwaitHelper.execute(${worker[0].name}(parent, args, context, resolveInfo));`);
                    builder.appendLine(`\t\t\t\t\treturn customFunctionReturn;`);
                    builder.appendLine(`\t\t\t\t},`);
                    builder.appendLine(`\t\t\t},`);
                });

                builder.appendLine(`\t\t})`);
                builder.appendLine(`\t}),`);
                builder.appendLine(`});`);

                const functionPath: string = `${this.fileSystemWorker.getCurrentExecutionDirectory()}/${OmniHiveConstants.SERVER_OUTPUT_DIRECTORY}/graphql/CustomFunctionFederatedGraphSchema.js`;
                this.fileSystemWorker.writeDataToFile(functionPath, builder.outputString());
            }

            this.logWorker.write(OmniHiveLogLevel.Info, `Graph Generation Files Completed`);
            this.logWorker.write(OmniHiveLogLevel.Info, `Graph Schema Build Completed Successfully`);
            this.logWorker.write(OmniHiveLogLevel.Info, `Booting Up Graph Server`);

            // Register graph builder databases
            this.logWorker.write(OmniHiveLogLevel.Info, `Graph Progress => Database Graph Endpoint Registering`);

            for (const builder of buildWorkers) {

                const builderMeta = builder[0].metadata as HiveWorkerMetadataGraphBuilder;

                const builderDbWorkers = dbWorkers.filter((worker: [HiveWorker, any, string]) => builder[0].name === worker[2]);

                if (builderDbWorkers.length > 0) {
                    let graphDatabaseSchema: any;

                    let databaseWorkerIndex: number = 0;

                    for (const databaseWorker of builderDbWorkers) {

                        const databaseFileName: string = `${this.fileSystemWorker.getCurrentExecutionDirectory()}/${OmniHiveConstants.SERVER_OUTPUT_DIRECTORY}/graphql/${builder[0].name}_${databaseWorker[0].name}_FederatedGraphSchema.js`;
                        const databaseDynamicModule: any = await import(databaseFileName);
                        const databaseQuerySchema: any = databaseDynamicModule.FederatedGraphQuerySchema;

                        if (databaseWorkerIndex === 0) {
                            graphDatabaseSchema = databaseQuerySchema;
                        } else {
                            graphDatabaseSchema = mergeSchemas({ schemas: [graphDatabaseSchema, databaseQuerySchema] });
                        }

                        this.logWorker.write(OmniHiveLogLevel.Info, `Graph Progress => ${builder[0].name} => ${databaseWorker[0].name} Query Schema Merged`);

                        const procSchema: any = databaseDynamicModule.FederatedGraphStoredProcSchema;

                        if (procSchema) {
                            graphDatabaseSchema = mergeSchemas({ schemas: [graphDatabaseSchema, procSchema] });
                        }

                        this.logWorker.write(OmniHiveLogLevel.Info, `Graph Progress => ${builder[0].name} => ${databaseWorker[0].name} Stored Proc Schema Merged`);

                        databaseWorkerIndex++;
                    }

                    const graphDatabaseConfig: ApolloServerExpressConfig = {
                        schema: graphDatabaseSchema,
                        tracing: QueenStore.getInstance().settings.server.developerMode,
                        context: async ({ req }) => {
                            const tokens = {
                                access: req.headers.ohaccess || ``,
                                auth: req.headers.authorization || ``,
                                cache: req.headers.ohcache || ``,
                                cacheSeconds: req.headers.ohcacheseconds
                            };
                            return { tokens };
                        },
                    };

                    if (QueenStore.getInstance().settings.server.enableGraphPlayground) {
                        graphDatabaseConfig.introspection = true;
                        graphDatabaseConfig.playground = {
                            endpoint: `${QueenStore.getInstance().settings.server.rootUrl}/graphql/database${builderMeta.graphUrl}`
                        };
                    } else {
                        graphDatabaseConfig.introspection = false;
                        graphDatabaseConfig.playground = false;
                    }

                    const graphDatabaseServer: ApolloServer = new ApolloServer(graphDatabaseConfig);
                    graphDatabaseServer.applyMiddleware({ app, path: `/graphql/database${builderMeta.graphUrl}` });
                }
            }

            this.logWorker.write(OmniHiveLogLevel.Info, `Graph Progress => Database Graph Endpoint Registered`);

            // Register custom graph apollo server
            this.logWorker.write(OmniHiveLogLevel.Info, `Graph Progress => Custom Functions Graph Endpoint Registering`);

            if (HiveWorkerFactory.getInstance().workers.some((worker: [HiveWorker, any]) => worker[0].type === HiveWorkerType.GraphEndpointFunction && worker[0].enabled === true)) {

                const functionFileName: string = `${this.fileSystemWorker.getCurrentExecutionDirectory()}/${OmniHiveConstants.SERVER_OUTPUT_DIRECTORY}/graphql/CustomFunctionFederatedGraphSchema.js`;
                const functionDynamicModule: any = await import(functionFileName);
                const graphFunctionSchema: any = functionDynamicModule.FederatedCustomFunctionQuerySchema;

                const graphFunctionConfig: ApolloServerExpressConfig = {
                    schema: graphFunctionSchema,
                    tracing: QueenStore.getInstance().settings.server.developerMode,
                    context: async ({ req }) => {
                        const tokens = {
                            access: req.headers.ohaccess || ``,
                            auth: req.headers.authorization || ``,
                            cache: req.headers.ohcache || ``,
                            cacheSeconds: req.headers.ohcacheseconds
                        };
                        return { tokens };
                    },
                };

                if (QueenStore.getInstance().settings.server.enableGraphPlayground) {
                    graphFunctionConfig.introspection = true;
                    graphFunctionConfig.playground = {
                        endpoint: `${QueenStore.getInstance().settings.server.rootUrl}/graphql/custom`
                    };
                } else {
                    graphFunctionConfig.introspection = false;
                    graphFunctionConfig.playground = false;
                }

                const graphFunctionServer: ApolloServer = new ApolloServer(graphFunctionConfig);
                graphFunctionServer.applyMiddleware({ app, path: `/graphql/custom` });

            }

            this.logWorker.write(OmniHiveLogLevel.Info, `Graph Progress => Custom Functions Endpoint Registered`);
            this.logWorker.write(OmniHiveLogLevel.Info, `REST Server Generation Started`);

            // Register "custom" REST endpoints
            if (HiveWorkerFactory.getInstance().workers.some((worker: [HiveWorker, any]) => worker[0].type === HiveWorkerType.RestEndpointFunction && worker[0].enabled === true)) {

                const swaggerDefinition: swaggerUi.JsonObject = {
                    info: {
                        title: "OmniHive Custom Function REST Interface",
                        version: "1.0.0",
                        description: "All custom REST endpoint functions written by the OmniHive account administrators",
                    },
                    license: {},
                    openapi: "3.0.0",
                    servers: [
                        {
                            url: `${QueenStore.getInstance().settings.server.rootUrl}${OmniHiveConstants.CUSTOM_REST_ROOT}`,
                        },
                    ],
                };

                for (const restWorker of HiveWorkerFactory.getInstance().workers.filter((worker: [HiveWorker, any]) => worker[0].type === HiveWorkerType.RestEndpointFunction && worker[0].enabled === true)) {

                    const workerInstance: IRestEndpointWorker = restWorker[1] as IRestEndpointWorker;
                    workerInstance.register(app, OmniHiveConstants.CUSTOM_REST_ROOT);
                    const newWorkerSwagger: swaggerUi.JsonObject | undefined = workerInstance.getSwaggerDefinition();

                    if (newWorkerSwagger) {
                        swaggerDefinition.paths = { ...swaggerDefinition.paths, ...newWorkerSwagger.paths };
                        swaggerDefinition.definitions = { ...swaggerDefinition.definitions, ...newWorkerSwagger.definitions };
                    }
                }

                if (QueenStore.getInstance().settings.server.enableSwagger) {
                    app.use(`${OmniHiveConstants.CUSTOM_REST_ROOT}/api-docs`, swaggerUi.serve, swaggerUi.setup(swaggerDefinition));
                }
            }

            this.logWorker.write(OmniHiveLogLevel.Info, `REST Server Generation Completed`);
            QueenStore.getInstance().changeSystemStatus(ServerStatus.Online);

            app.get("/", (_req, res) => {
                res.setHeader('Content-Type', 'application/json');
                return res.status(200).json(QueenStore.getInstance().status);
            });

            this.logWorker.write(OmniHiveLogLevel.Info, `New Server Built`);

            // Rebuild server
            ServerStore.getInstance().appServer = app;


        } catch (err) {
            this.logWorker.write(OmniHiveLogLevel.Error, `Server Spin-Up Error => ${JSON.stringify(serializeError(err))}`);
            throw new Error(err);
        }

    }
}