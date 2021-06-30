/// <reference path="../../../types/globals.omnihive.d.ts" />

import { FieldNode, GraphQLResolveInfo } from "graphql";
import { GraphContext } from "@withonevision/omnihive-core/models/GraphContext";
import { ILogWorker } from "@withonevision/omnihive-core/interfaces/ILogWorker";
import { IDatabaseWorker } from "@withonevision/omnihive-core/interfaces/IDatabaseWorker";
import { IEncryptionWorker } from "@withonevision/omnihive-core/interfaces/IEncryptionWorker";
import { ICacheWorker } from "@withonevision/omnihive-core/interfaces/ICacheWorker";
import { IDateWorker } from "@withonevision/omnihive-core/interfaces/IDateWorker";
import { Knex } from "knex";
import { TableSchema } from "@withonevision/omnihive-core/models/TableSchema";
import { GraphHelper } from "../helpers/GraphHelper";
import { OmniHiveLogLevel } from "@withonevision/omnihive-core/enums/OmniHiveLogLevel";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";

export class ParseAstQuery {
    // Workers
    private logWorker: ILogWorker | undefined;
    private databaseWorker: IDatabaseWorker | undefined;
    private encryptionWorker: IEncryptionWorker | undefined;
    private cacheWorker!: ICacheWorker | undefined;
    private dateWorker!: IDateWorker | undefined;

    // Helpers
    private graphHelper: GraphHelper = new GraphHelper();

    // Global Values
    private knex: Knex | undefined;
    private builder: Knex.QueryBuilder<any, unknown[]> | undefined;
    private queryStructure: any = {};
    private schema: { [tableName: string]: TableSchema[] } = {};
    private parentCall: string = "";
    private selectionFields: TableSchema[] = [];
    private fieldAliasMap: { name: string; alias: string }[] = [];

    // Static Values
    private joinFieldSuffix: string = "_table";

    /**
     * Parse a GraphQL query into a database query and return the results to graph
     *
     * @param workerName
     * @param _args
     * @param resolveInfo
     * @param omniHiveContext
     * @param schema
     * @returns { Promise<any> }
     */
    public parse = async (
        workerName: string,
        _args: any,
        resolveInfo: GraphQLResolveInfo,
        omniHiveContext: GraphContext,
        schema: { [tableName: string]: TableSchema[] }
    ): Promise<any> => {
        try {
            // Store the schema for global use
            this.schema = schema;

            // Set the required worker values
            const { logWorker, databaseWorker, knex, encryptionWorker, cacheWorker, dateWorker } =
                this.graphHelper.getRequiredWorkers(workerName);
            this.logWorker = logWorker;
            this.databaseWorker = databaseWorker;
            this.knex = knex;
            this.encryptionWorker = encryptionWorker;
            this.cacheWorker = cacheWorker;
            this.dateWorker = dateWorker;

            // Verify the authenticity of the access token
            // TODO: UNCOMMENT THIS LINE
            // await AwaitHelper.execute(this.graphHelper.verifyToken(omniHiveContext));

            // Build the database query
            this.buildQuery(resolveInfo);

            // Process the built query
            return await AwaitHelper.execute(this.processQuery(workerName, omniHiveContext));
        } catch (err) {
            throw err;
        }
    };

    /**
     * Build the database query from the graph query
     *
     * @param resolveInfo GraphQL Query Object
     * @returns { void }
     */
    private buildQuery = (resolveInfo: GraphQLResolveInfo): void => {
        // If the knex object is not set then throw an error
        if (!this.knex) {
            throw new Error("Knex object is not initialized");
        }

        // Create the query builder
        this.builder = this.knex.queryBuilder();

        // Retrieve the primary table being accessed
        this.parentCall = resolveInfo.fieldName;

        // Generate the query structure from the graph object for the current parent value
        this.queryStructure = this.graphHelper.buildQueryStructure(
            resolveInfo.fieldNodes.filter((x) => (x as FieldNode).name.value === this.parentCall) as FieldNode[],
            this.parentCall,
            0,
            this.fieldAliasMap,
            this.parentCall,
            this.schema
        );

        // Iterate through each query structure's parent value found
        Object.keys(this.queryStructure).forEach((key) => {
            // If the builder was not initialized properly throw an error
            if (!this.builder) {
                throw new Error("Knex Query Builder did not initialize correctly");
            }

            // Retrieve the parent values TableSchema values
            const tableSchema: TableSchema[] = this.schema[key];
            this.builder?.from(`${tableSchema[0].tableName} as t1`);

            // Build queries for the current query structure
            this.graphToKnex(this.queryStructure[key], this.parentCall, this.parentCall);
        });
    };

    /**
     * Convert the generated structure into a knex query
     *
     * @param structure Structure of the graph query object
     * @param parentKey Parent key of the calling structure level
     * @param queryKey Structure's key for joining to foreign tables from the parent table
     * @returns { void }
     */
    private graphToKnex = (structure: any, parentKey: string, queryKey: string): void => {
        // If the query builder is not initialized properly then throw an error
        if (!this.builder) {
            throw new Error("Knex Query Builder not initialized");
        }

        // If the query structure is not built properly then throw an error
        if (!structure || Object.keys(structure).length <= 0) {
            throw new Error("The Graph Query is not structured properly");
        }

        // Build the select values
        this.buildSelect(structure.columns, structure.tableAlias, parentKey);

        // Build the joining values
        this.buildJoins(structure, parentKey, queryKey);

        // if arguments exist on the structure level and are not a join that is set to specific
        //  then build the conditional query specifications
        if (
            !structure.args?.join ||
            (structure.args?.join?.whereMode && structure.args?.join?.whereMode === "global")
        ) {
            this.graphHelper.buildConditions(
                structure.args,
                structure.tableAlias,
                this.builder,
                parentKey,
                this.schema,
                this.knex
            );
        }

        // Iterate through each graph sub-query to recursively build the database query
        Object.keys(structure).forEach((key) => {
            // Build inner queries
            if (key.endsWith(this.joinFieldSuffix)) {
                this.graphToKnex(structure[key], structure[key].tableKey, key);
            }
        });
    };

    /**
     * Build the select segment of the database query
     *
     * @param columns Column object containing the entity name and the alias the column should be given
     * @param tableAlias The table alias of the columns parent table
     * @param tableName The entity name of the parent table
     */
    private buildSelect = (columns: { name: string; alias: string }[], tableAlias: string, tableName: string): void => {
        // If the columns object exists
        if (columns) {
            // Iterate through each column item to build the select segment of the database query
            columns.forEach((field) => {
                // Find the TableSchema object of the given table
                const column = this.schema[tableName].find((column) => column.columnNameEntity === field.name);

                // If the TableSchema is found and is not already in the database query then add the column to the query
                if (column && !this.selectionFields.some((x) => x.columnNameEntity === column.columnNameEntity)) {
                    // Save the column to the global variable for comparison
                    this.selectionFields.push(column);

                    this.builder?.distinct(`${tableAlias}.${column.columnNameDatabase} as ${field.alias}`);
                }
            });
        }
    };

    /**
     * Build joins into foreign tables
     *
     * @param structure Structure of the graph query object
     * @param tableKey Parent key of the calling structure level
     * @param queryKey Structure's key for joining to foreign tables from the parent table
     * @returns { void }
     */
    private buildJoins = (structure: any, tableKey: string, queryKey: string): void => {
        // If the builder is not initialized properly then throw an error
        if (!this.builder) {
            throw new Error("Knex Query Builder not initialized");
        }

        // If the current structure level has an argument that contains a join property then this is a proper join
        if (structure.args?.join) {
            // Retrieve the table the query is joining to
            let joinTable: string = this.schema[tableKey]?.[0]?.tableName;

            let primaryColumnName: string = "";
            let linkingColumnName: string = "";

            // Set schema key based on directionality of the join
            const schemaKey = structure.linkingTableKey ? structure.linkingTableKey : tableKey;

            // Retrieve the TableSchema of the column in the parent table
            const primaryColumn: TableSchema | undefined = this.schema[schemaKey]?.find(
                (x) =>
                    x.columnNameEntity === structure.args.join.from ||
                    (!structure.args.join.from && x.columnNameEntity === queryKey.replace(this.joinFieldSuffix, ""))
            );

            let parentAlias = "";

            // If the primary column was found this is a proper join
            if (primaryColumn) {
                primaryColumnName = `${primaryColumn.columnNameDatabase}`;
                linkingColumnName = `${primaryColumn.columnForeignKeyColumnName}`;

                // Get the table aliases and all joining information for the database joins
                if (structure.linkingTableKey) {
                    parentAlias = this.findParentAlias(this.queryStructure[this.parentCall], schemaKey);
                    joinTable = primaryColumn.columnForeignKeyTableName;

                    primaryColumnName = `${parentAlias}.${primaryColumnName}`;
                    linkingColumnName = `${structure.tableAlias}.${linkingColumnName}`;
                } else {
                    parentAlias = this.findParentAlias(
                        this.queryStructure[this.parentCall],
                        primaryColumn.schemaName + primaryColumn.columnForeignKeyTableNamePascalCase
                    );
                    primaryColumnName = `${structure.tableAlias}.${primaryColumnName}`;
                    linkingColumnName = `${parentAlias}.${linkingColumnName}`;
                }

                // Get the join's whereMode property
                const whereSpecific: boolean = structure.args?.join?.whereMode === "specific";

                // Build the database query segment for the specified join
                switch (structure.args.join.type) {
                    case "inner": {
                        // If whereMode is specific then add the conditions on the join
                        if (whereSpecific) {
                            this.builder.innerJoin(`${joinTable} as ${structure.tableAlias}`, (builder) => {
                                builder.on(primaryColumnName, "=", linkingColumnName);
                                this.graphHelper.buildConditions(
                                    structure.args,
                                    structure.tableAlias,
                                    builder,
                                    tableKey,
                                    this.schema,
                                    this.knex,
                                    true
                                );
                            });
                        }
                        // Else add the standard join
                        else {
                            this.builder.innerJoin(
                                `${joinTable} as ${structure.tableAlias}`,
                                primaryColumnName,
                                linkingColumnName
                            );
                        }
                        break;
                    }
                    case "left": {
                        // If whereMode is specific then add the conditions on the join
                        if (whereSpecific) {
                            this.builder.leftJoin(`${joinTable} as ${structure.tableAlias}`, (builder) => {
                                builder.on(primaryColumnName, "=", linkingColumnName);
                                this.graphHelper.buildConditions(
                                    structure.args,
                                    structure.tableAlias,
                                    builder,
                                    tableKey,
                                    this.schema,
                                    this.knex,
                                    true
                                );
                            });
                        }
                        // Else add the standard join
                        else {
                            this.builder.leftJoin(
                                `${joinTable} as ${structure.tableAlias}`,
                                primaryColumnName,
                                linkingColumnName
                            );
                        }
                        break;
                    }
                    case "leftOuter": {
                        // If whereMode is specific then add the conditions on the join
                        if (whereSpecific) {
                            this.builder.leftOuterJoin(`${joinTable} as ${structure.tableAlias}`, (builder) => {
                                builder.on(primaryColumnName, "=", linkingColumnName);
                                this.graphHelper.buildConditions(
                                    structure.args,
                                    structure.tableAlias,
                                    builder,
                                    tableKey,
                                    this.schema,
                                    this.knex,
                                    true
                                );
                            });
                        }
                        // Else add the standard join
                        else {
                            this.builder.leftOuterJoin(
                                `${joinTable} as ${structure.tableAlias}`,
                                primaryColumnName,
                                linkingColumnName
                            );
                        }
                        break;
                    }
                    case "right": {
                        // If whereMode is specific then add the conditions on the join
                        if (whereSpecific) {
                            this.builder.rightJoin(`${joinTable} as ${structure.tableAlias}`, (builder) => {
                                builder.on(primaryColumnName, "=", linkingColumnName);
                                this.graphHelper.buildConditions(
                                    structure.args,
                                    structure.tableAlias,
                                    builder,
                                    tableKey,
                                    this.schema,
                                    this.knex,
                                    true
                                );
                            });
                        }
                        // Else add the standard join
                        else {
                            this.builder.rightJoin(
                                `${joinTable} as ${structure.tableAlias}`,
                                primaryColumnName,
                                linkingColumnName
                            );
                        }
                        break;
                    }
                    case "rightOuter": {
                        // If whereMode is specific then add the conditions on the join
                        if (whereSpecific) {
                            this.builder.rightOuterJoin(`${joinTable} as ${structure.tableAlias}`, (builder) => {
                                builder.on(primaryColumnName, "=", linkingColumnName);
                                this.graphHelper.buildConditions(
                                    structure.args,
                                    structure.tableAlias,
                                    builder,
                                    tableKey,
                                    this.schema,
                                    this.knex,
                                    true
                                );
                            });
                        }
                        // Else add the standard join
                        else {
                            this.builder.rightOuterJoin(
                                `${joinTable} as ${structure.tableAlias}`,
                                primaryColumnName,
                                linkingColumnName
                            );
                        }
                        break;
                    }
                    case "fullOuter": {
                        // If whereMode is specific then add the conditions on the join
                        if (whereSpecific) {
                            this.builder.fullOuterJoin(`${joinTable} as ${structure.tableAlias}`, (builder) => {
                                builder.on(primaryColumnName, "=", linkingColumnName);
                                this.graphHelper.buildConditions(
                                    structure.args,
                                    structure.tableAlias,
                                    builder,
                                    tableKey,
                                    this.schema,
                                    this.knex,
                                    true
                                );
                            });
                        }
                        // Else add the standard join
                        else {
                            this.builder.fullOuterJoin(
                                `${joinTable} as ${structure.tableAlias}`,
                                primaryColumnName,
                                linkingColumnName
                            );
                        }
                        break;
                    }
                    case "cross": {
                        // If whereMode is specific then add the conditions on the join
                        if (whereSpecific) {
                            this.builder.crossJoin(`${joinTable} as ${structure.tableAlias}`, (builder) => {
                                builder.on(primaryColumnName, "=", linkingColumnName);
                                this.graphHelper.buildConditions(
                                    structure.args,
                                    structure.tableAlias,
                                    builder,
                                    tableKey,
                                    this.schema,
                                    this.knex,
                                    true
                                );
                            });
                        }
                        // Else add the standard join
                        else {
                            this.builder.crossJoin(
                                `${joinTable} as ${structure.tableAlias}`,
                                primaryColumnName,
                                linkingColumnName
                            );
                        }
                        break;
                    }
                    default: {
                        // If whereMode is specific then add the conditions on the join
                        if (whereSpecific) {
                            this.builder.join(`${joinTable} as ${structure.tableAlias}`, (builder) => {
                                builder.on(primaryColumnName, "=", linkingColumnName);
                                this.graphHelper.buildConditions(
                                    structure.args,
                                    structure.tableAlias,
                                    builder,
                                    tableKey,
                                    this.schema,
                                    this.knex,
                                    true
                                );
                            });
                        }
                        // Else add the standard join
                        else {
                            this.builder.join(
                                `${joinTable} as ${structure.tableAlias}`,
                                primaryColumnName,
                                linkingColumnName
                            );
                        }
                        break;
                    }
                }
            }
        }
    };

    /**
     * Find the given tableKey's database query alias
     *
     * @param structure Structure of the graph query object
     * @param tableKey Table Key to search on
     * @returns { string }
     */
    private findParentAlias = (structure: any, tableKey: string): string => {
        // If the structure tableKey is the search tableKey then return the structure's tableAlias value
        if (structure.tableKey === tableKey) {
            return structure.tableAlias;
        }
        // Else recursively iterate down the structure's definition until the desired value is found
        // or there are no more values to search upon
        else {
            for (const key in structure) {
                let alias: string = "";
                if (key.endsWith(this.joinFieldSuffix)) {
                    alias = this.findParentAlias(structure[key], tableKey);
                }

                // If a value was found return it
                if (alias) {
                    return alias;
                }
            }

            // Else return a blank string
            return "";
        }
    };

    /**
     * Process the query that was generated
     *
     * @param workerName
     * @param omniHiveContext
     * @returns { Promise<any> }
     */
    private processQuery = async (workerName: string, omniHiveContext: any): Promise<any> => {
        // If the database query builder exists
        if (this.builder) {
            let cacheKey: string | undefined = "";
            let cacheSeconds: number = -1;
            const sql = this.builder.toString();

            // Retrieve the cache seconds from the OmniHive Context
            if (omniHiveContext?.cacheSeconds) {
                try {
                    cacheSeconds = +omniHiveContext.cacheSeconds;
                } catch {
                    cacheSeconds = -1;
                }
            }

            // If the caching level is not set to none retrieve the cache key for the query
            if (omniHiveContext?.cache && omniHiveContext.cache !== "none") {
                cacheKey = this.encryptionWorker?.base64Encode(workerName + "||||" + sql);
            }

            // Check the cache to see if results are stored
            let results: any = await AwaitHelper.execute(this.checkCache(workerName, omniHiveContext, sql, cacheKey));

            // If results are not stored in the cache run the query
            if (!results && this.databaseWorker) {
                // Execute the database queries
                results = await AwaitHelper.execute(this.databaseWorker.executeQuery(sql));
            }

            // If results are returned then hydrate the results back into graph
            if (results) {
                const graphResult = this.graphHelper.buildGraphReturn(
                    this.queryStructure[this.parentCall],
                    results[0],
                    this.dateWorker
                );

                // Store the results in the cache
                await AwaitHelper.execute(
                    this.setCache(workerName, omniHiveContext, sql, cacheKey, cacheSeconds, graphResult)
                );

                // Return the results
                return graphResult;
            }

            // If this point is reached an error occurred on the parsing of the sql results
            return {
                error: "An unexpected error occurred when transforming the database results back into the graph object structure",
            };
        }
    };

    /**
     * See if the sql query has been saved in the cache
     *
     * @param workerName
     * @param omniHiveContext
     * @param sql
     * @param cacheKey
     * @returns { Promise<any> }
     */
    private checkCache = async (
        workerName: string,
        omniHiveContext: any,
        sql: string,
        cacheKey: string | undefined
    ): Promise<any> => {
        if (this.cacheWorker) {
            // Check the context to see if caching flags are set
            if (omniHiveContext?.cache && omniHiveContext.cache === "cache" && cacheKey) {
                // Verify the key exists
                const keyExists: boolean = await AwaitHelper.execute(this.cacheWorker.exists(cacheKey));

                // If the key exists retrieve the results
                if (keyExists) {
                    this.logWorker?.write(OmniHiveLogLevel.Info, `(Retrieved from Cache) => ${workerName} => ${sql}`);
                    const cacheResults: string | undefined = await AwaitHelper.execute(this.cacheWorker.get(cacheKey));

                    try {
                        // If results are not falsy then return the Object
                        if (cacheResults) {
                            return JSON.parse(cacheResults);
                        }
                    } catch {
                        omniHiveContext.cache = "cacheRefresh";
                    }
                }
            }
        }
    };

    /**
     * Set the results in the cache
     *
     * @param workerName
     * @param omniHiveContext
     * @param sql
     * @param cacheKey
     * @param cacheSeconds
     * @param results
     * @returns { Promise<void> }
     */
    private setCache = async (
        workerName: string,
        omniHiveContext: any,
        sql: string,
        cacheKey: string | undefined,
        cacheSeconds: number,
        results: any
    ): Promise<void> => {
        if (this.cacheWorker) {
            // If the no caching flag is not set save the results to cache
            if (omniHiveContext?.cache && omniHiveContext.cache !== "none" && cacheKey) {
                this.logWorker?.write(OmniHiveLogLevel.Info, `(Written to Cache) => ${workerName} => ${sql}`);
                this.cacheWorker.set(cacheKey, JSON.stringify(results), cacheSeconds);
            }
        }
    };
}
