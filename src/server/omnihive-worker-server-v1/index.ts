/// <reference path="../../types/globals.omnihive.d.ts" />

import { mergeSchemas } from "@graphql-tools/schema";
import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { OmniHiveLogLevel } from "@withonevision/omnihive-core/enums/OmniHiveLogLevel";
import { RegisteredUrlType } from "@withonevision/omnihive-core/enums/RegisteredUrlType";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { IsHelper } from "@withonevision/omnihive-core/helpers/IsHelper";
import { IDatabaseWorker } from "@withonevision/omnihive-core/interfaces/IDatabaseWorker";
import { IGraphBuildWorker } from "@withonevision/omnihive-core/interfaces/IGraphBuildWorker";
import { ILogWorker } from "@withonevision/omnihive-core/interfaces/ILogWorker";
import { IServerWorker } from "@withonevision/omnihive-core/interfaces/IServerWorker";
import { ConnectionSchema } from "@withonevision/omnihive-core/models/ConnectionSchema";
import { HiveWorkerBase } from "@withonevision/omnihive-core/models/HiveWorkerBase";
import { HiveWorkerMetadataDatabase } from "@withonevision/omnihive-core/models/HiveWorkerMetadataDatabase";
import { HiveWorkerMetadataGraphBuilder } from "@withonevision/omnihive-core/models/HiveWorkerMetadataGraphBuilder";
import { HiveWorkerMetadataServer } from "@withonevision/omnihive-core/models/HiveWorkerMetadataServer";
import { RegisteredHiveWorker } from "@withonevision/omnihive-core/models/RegisteredHiveWorker";
import { TableSchema } from "@withonevision/omnihive-core/models/TableSchema";
import { ApolloServer, ApolloServerExpressConfig } from "apollo-server-express";
import { camelCase } from "change-case";
import { transformSync } from "esbuild";
import express from "express";
import Module from "module";
import { nanoid } from "nanoid";
import { serializeError } from "serialize-error";
import { runInNewContext } from "vm";
import { ApolloServerPluginLandingPageGraphQLPlayground } from "apollo-server-core";

type BuilderDatabaseWorker = {
    registeredWorker: RegisteredHiveWorker;
    builderName: string;
};

export default class CoreServerWorker extends HiveWorkerBase implements IServerWorker {
    private typedMetadata!: HiveWorkerMetadataServer;

    private webRootUrl = global.omnihive.getEnvironmentVariable<string>("OH_WEB_ROOT_URL");
    private graphIntrospection =
        global.omnihive.getEnvironmentVariable<boolean>("OH_CORE_GRAPH_INTROSPECTION") ?? false;
    private graphPlayground = global.omnihive.getEnvironmentVariable<boolean>("OH_CORE_GRAPH_PLAYGROUND") ?? true;

    constructor() {
        super();
    }

    public async init(name: string, metadata?: any): Promise<void> {
        await AwaitHelper.execute(super.init(name, metadata));

        try {
            this.name = name;
            this.typedMetadata = this.checkObjectStructure<HiveWorkerMetadataServer>(
                HiveWorkerMetadataServer,
                metadata
            );
        } catch (error) {
            throw new Error(`Server ${name} => Server Init Error => ${JSON.stringify(serializeError(error))}`);
        }
    }

    public buildServer = async (app: express.Express): Promise<express.Express> => {
        if (IsHelper.isNullOrUndefinedOrEmptyStringOrWhitespace(this.webRootUrl)) {
            throw new Error("OH_WEB_ROOT_URL is not defined");
        }

        const logWorker: ILogWorker | undefined = this.getWorker<ILogWorker | undefined>(HiveWorkerType.Log);

        try {
            logWorker?.write(OmniHiveLogLevel.Info, `Server ${this.name} => Graph Connection Schemas Being Loaded`);

            // Get build workers
            const buildWorkers: RegisteredHiveWorker[] = [];

            this.registeredWorkers.forEach((worker: RegisteredHiveWorker) => {
                if (
                    worker.type === HiveWorkerType.GraphBuilder &&
                    (this.typedMetadata.buildWorkers.includes("*") ||
                        this.typedMetadata.buildWorkers.includes(worker.name))
                ) {
                    buildWorkers.push(worker);
                }
            });

            // Get db workers
            const dbWorkers: BuilderDatabaseWorker[] = [];

            buildWorkers.forEach((worker: RegisteredHiveWorker) => {
                const buildWorkerMetadata: HiveWorkerMetadataGraphBuilder =
                    worker.metadata as HiveWorkerMetadataGraphBuilder;

                if (buildWorkerMetadata.dbWorkers.includes("*")) {
                    this.registeredWorkers
                        .filter((worker: RegisteredHiveWorker) => worker.type === HiveWorkerType.Database)
                        .forEach((dbWorker: RegisteredHiveWorker) => {
                            dbWorkers.push({ registeredWorker: dbWorker, builderName: worker.name });
                        });
                } else {
                    buildWorkerMetadata.dbWorkers.forEach((value: string) => {
                        const dbWorker: RegisteredHiveWorker | undefined = this.registeredWorkers.find(
                            (worker: RegisteredHiveWorker) =>
                                worker.name === value && worker.type === HiveWorkerType.Database
                        );
                        if (!IsHelper.isNullOrUndefined(dbWorker)) {
                            dbWorkers.push({ registeredWorker: dbWorker, builderName: worker.name });
                        }
                    });
                }
            });

            // Write database schemas

            for (const worker of dbWorkers) {
                logWorker?.write(
                    OmniHiveLogLevel.Info,
                    `Server ${this.name} => Retrieving ${worker.registeredWorker.name} Schema`
                );

                const dbWorkerMeta = worker.registeredWorker.metadata as HiveWorkerMetadataDatabase;
                const result: ConnectionSchema = await AwaitHelper.execute(
                    (worker.registeredWorker.instance as IDatabaseWorker).getSchema()
                );

                result.tables.forEach((schema: TableSchema) => {
                    if (dbWorkerMeta.ignoreSchema) {
                        schema.tableNameCamelCase = camelCase(schema.tableName);
                        schema.tableNamePascalCase = this.capitalizeFirstLetter(camelCase(schema.tableName));
                    } else {
                        schema.tableNameCamelCase = `${schema.schemaName.toLowerCase()}${this.capitalizeFirstLetter(
                            camelCase(schema.tableName)
                        )}`;
                        schema.tableNamePascalCase = `${this.capitalizeFirstLetter(
                            schema.schemaName.toLowerCase()
                        )}${this.capitalizeFirstLetter(camelCase(schema.tableName))}`;
                    }

                    if (schema.columnIsForeignKey) {
                        if (dbWorkerMeta.ignoreSchema) {
                            schema.columnForeignKeyTableNameCamelCase = camelCase(schema.columnForeignKeyTableName);
                            schema.columnForeignKeyTableNamePascalCase = this.capitalizeFirstLetter(
                                camelCase(schema.columnForeignKeyTableName)
                            );
                        } else {
                            schema.columnForeignKeyTableNameCamelCase = `${schema.schemaName.toLowerCase()}${this.capitalizeFirstLetter(
                                camelCase(schema.columnForeignKeyTableName)
                            )}`;
                            schema.columnForeignKeyTableNamePascalCase = `${this.capitalizeFirstLetter(
                                camelCase(schema.schemaName)
                            )}${this.capitalizeFirstLetter(camelCase(schema.columnForeignKeyTableName))}`;
                        }
                    }

                    let columnWorkingName = camelCase(schema.columnNameDatabase);

                    columnWorkingName = columnWorkingName.replace(/[^a-zA-Z0-9 ]+/g, "");
                    columnWorkingName = columnWorkingName.replace(/ /g, "_");
                    columnWorkingName = columnWorkingName.charAt(0).toLowerCase() + columnWorkingName.slice(1);

                    if (IsHelper.isNumber(schema.columnNameDatabase.substring(0, 1))) {
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

                global.omnihive.registeredSchemas.push({
                    workerName: worker.registeredWorker.name,
                    tables: result.tables,
                    procFunctions: result.procFunctions,
                });
            }

            logWorker?.write(OmniHiveLogLevel.Info, `Server ${this.name} => Graph Connection Schemas Completed`);
            logWorker?.write(OmniHiveLogLevel.Info, `Server ${this.name} => Writing Graph Generation Files`);

            // Get all build workers and write out their graph schema
            const dbWorkerModules: { dbWorkerName: string; builderWorkerName: string; dbModule: any }[] = [];

            for (const builder of buildWorkers) {
                const buildWorker: IGraphBuildWorker = builder.instance as IGraphBuildWorker;

                for (const dbWorker of dbWorkers.filter(
                    (worker: BuilderDatabaseWorker) => worker.builderName === buildWorker.name
                )) {
                    const databaseWorker: IDatabaseWorker = dbWorker.registeredWorker.instance as IDatabaseWorker;
                    const schema: ConnectionSchema | undefined = global.omnihive.registeredSchemas.find(
                        (value: ConnectionSchema) => value.workerName === dbWorker.registeredWorker.name
                    );

                    const graphWorkerReturn = await buildWorker.buildDatabaseWorkerSchema(databaseWorker, schema);
                    let dbWorkerModule: any = undefined;

                    if (typeof graphWorkerReturn === "string") {
                        dbWorkerModule = this.importFromString(graphWorkerReturn);
                    } else {
                        dbWorkerModule = {
                            FederatedGraphQuerySchema: graphWorkerReturn,
                        };
                    }

                    dbWorkerModules.push({
                        dbWorkerName: dbWorker.registeredWorker.name,
                        builderWorkerName: builder.name,
                        dbModule: dbWorkerModule,
                    });
                }
            }

            // Register graph builder databases
            logWorker?.write(
                OmniHiveLogLevel.Info,
                `Server ${this.name} => Graph Progress => Database Graph Endpoint Registering`
            );

            for (const builder of buildWorkers) {
                const builderMeta = builder.metadata as HiveWorkerMetadataGraphBuilder;

                const builderDbWorkers = dbWorkers.filter(
                    (worker: BuilderDatabaseWorker) => builder.name === worker.builderName
                );

                if (!IsHelper.isEmptyArray(builderDbWorkers)) {
                    for (const databaseWorker of builderDbWorkers) {
                        const dbWorkerMeta = databaseWorker.registeredWorker.metadata as HiveWorkerMetadataDatabase;
                        let graphDatabaseSchema: any;

                        const databaseDynamicModule: any = dbWorkerModules.filter(
                            (value) =>
                                value.dbWorkerName === databaseWorker.registeredWorker.name &&
                                value.builderWorkerName === builder.name
                        )[0].dbModule;
                        const databaseQuerySchema: any = databaseDynamicModule.FederatedGraphQuerySchema;

                        // eslint-disable-next-line prefer-const
                        graphDatabaseSchema = databaseQuerySchema;

                        logWorker?.write(
                            OmniHiveLogLevel.Info,
                            `Server ${this.name} => Graph Progress => ${builder.name} => ${databaseWorker.registeredWorker.name} Query Schema Merged`
                        );

                        const procSchema: any = databaseDynamicModule.FederatedGraphProcSchema;

                        if (!IsHelper.isNullOrUndefined(procSchema)) {
                            graphDatabaseSchema = mergeSchemas({ schemas: [graphDatabaseSchema, procSchema] });
                        }

                        logWorker?.write(
                            OmniHiveLogLevel.Info,
                            `Server ${this.name} => Graph Progress => ${builder.name} => ${databaseWorker.registeredWorker.name} Proc Schema Merged`
                        );

                        const graphDatabaseConfig: ApolloServerExpressConfig = {
                            introspection: this.graphIntrospection,
                            schema: graphDatabaseSchema,
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

                        if (this.graphPlayground) {
                            graphDatabaseConfig.plugins?.push(
                                ApolloServerPluginLandingPageGraphQLPlayground({
                                    endpoint: `${this.webRootUrl}/${this.typedMetadata.urlRoute}/${builderMeta.urlRoute}/${dbWorkerMeta.urlRoute}`,
                                })
                            );
                        }

                        const graphDatabaseServer: ApolloServer = new ApolloServer(graphDatabaseConfig);
                        await graphDatabaseServer.start();
                        graphDatabaseServer.applyMiddleware({
                            app,
                            path: `/${this.typedMetadata.urlRoute}/${builderMeta.urlRoute}/${dbWorkerMeta.urlRoute}`,
                        });

                        global.omnihive.registeredUrls.push({
                            path: `${this.webRootUrl}/${this.typedMetadata.urlRoute}/${builderMeta.urlRoute}/${dbWorkerMeta.urlRoute}`,
                            type: RegisteredUrlType.GraphDatabase,
                            metadata: {},
                        });
                    }
                }
            }

            logWorker?.write(
                OmniHiveLogLevel.Info,
                `Server ${this.name} => Graph Progress => Database Graph Endpoint Registered`
            );

            // Return app
            return app;
        } catch (error) {
            logWorker?.write(
                OmniHiveLogLevel.Error,
                `Server ${this.name} => Server Spin-Up Error => ${JSON.stringify(serializeError(error))}`
            );
            throw error;
        }
    };

    private capitalizeFirstLetter(value: string) {
        return value.charAt(0).toUpperCase() + value.slice(1);
    }

    private importFromString = (code: string): any => {
        const transformResult = transformSync(code, { format: "cjs" });
        const contextModule = new Module(nanoid());

        runInNewContext(transformResult.code, {
            exports: contextModule.exports,
            module: contextModule,
            require,
        });

        return contextModule.exports;
    };
}
