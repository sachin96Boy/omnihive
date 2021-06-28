/// <reference path="../../../types/globals.omnihive.d.ts" />

import { FieldNode, GraphQLResolveInfo, ListValueNode, ObjectFieldNode, ObjectValueNode } from "graphql";
import { GraphContext } from "@withonevision/omnihive-core/models/GraphContext";
import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { ILogWorker } from "@withonevision/omnihive-core/interfaces/ILogWorker";
import { IsHelper } from "@withonevision/omnihive-core/helpers/IsHelper";
import { IDatabaseWorker } from "@withonevision/omnihive-core/interfaces/IDatabaseWorker";
import { IEncryptionWorker } from "@withonevision/omnihive-core/interfaces/IEncryptionWorker";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { ITokenWorker } from "@withonevision/omnihive-core/interfaces/ITokenWorker";
// import { ICacheWorker } from "@withonevision/omnihive-core/interfaces/ICacheWorker";
// import { IDateWorker } from "@withonevision/omnihive-core/interfaces/IDateWorker";
import { Knex } from "knex";
import { TableSchema } from "@withonevision/omnihive-core/models/TableSchema";

export class ParseAstQuery {
    //
    private logWorker: ILogWorker | undefined;
    private databaseWorker: IDatabaseWorker | undefined;
    private encryptionWorker: IEncryptionWorker | undefined;
    // private cacheWorker!: ICacheWorker | undefined;
    // private dateWorker!: IDateWorker | undefined;
    private knex: Knex | undefined;
    private joinFieldSuffix: string = "_table";

    private builder: Knex.QueryBuilder<any, unknown[]> | undefined;
    private queryStructure: any = {};
    private schema: { [tableName: string]: TableSchema[] } = {};
    private parentCall: string = "";
    private selectionFields: TableSchema[] = [];
    private columnCount: number = 0;
    private fieldAliasMap: { name: string; alias: string }[] = [];
    private graphReturn: any = [];

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
            this.setRequiredWorkers(workerName);

            // Verify the authenticity of the access token
            this.verifyToken(omniHiveContext);

            // Build the database query
            this.buildQuery(resolveInfo);

            // If the database query builder exists
            if (this.builder) {
                const results: any = [];

                // Execute the database queries
                results.push((await this.databaseWorker?.executeQuery(this.builder.toString()))?.[0]);

                // If results are returned then hydrate the results back into graph
                if (results) {
                    this.buildGraphReturn(this.queryStructure[this.parentCall], results[0]);
                }

                // Return the rehydrated results
                return this.graphReturn;
            }
        } catch (err) {
            throw err;
        }
    };

    /**
     * Set the required workers for the parser
     *
     * @param workerName
     * @returns { void }
     */
    private setRequiredWorkers = (workerName: string): void => {
        // Set the log worker
        this.logWorker = global.omnihive.getWorker<ILogWorker | undefined>(HiveWorkerType.Log);

        // If the log worker does not exist then throw an error
        if (IsHelper.isNullOrUndefined(this.logWorker)) {
            throw new Error("Log Worker Not Defined.  This graph converter will not work without a Log worker.");
        }

        // Set the database worker
        this.databaseWorker = global.omnihive.getWorker<IDatabaseWorker | undefined>(
            HiveWorkerType.Database,
            workerName
        );

        // If the database worker does not exist then throw an error
        if (IsHelper.isNullOrUndefined(this.databaseWorker)) {
            throw new Error(
                "Database Worker Not Defined.  This graph converter will not work without a Database worker."
            );
        }
        // Set the knex object from the database worker
        this.knex = this.databaseWorker.connection as Knex;

        // Set the encryption worker
        this.encryptionWorker = global.omnihive.getWorker<IEncryptionWorker | undefined>(HiveWorkerType.Encryption);

        // If the encryption worker does not exist then throw an error
        if (IsHelper.isNullOrUndefined(this.encryptionWorker)) {
            throw new Error(
                "Encryption Worker Not Defined.  This graph converter with Cache worker enabled will not work without an Encryption worker."
            );
        }

        // this.cacheWorker = global.omnihive.getWorker<ICacheWorker | undefined>(HiveWorkerType.Cache);
        // this.dateWorker = global.omnihive.getWorker<IDateWorker | undefined>(HiveWorkerType.Date);
    };

    /**
     * Verify the access token provided is valid
     *
     * @param omniHiveContext GraphQL Custom Headers
     * @returns { Promise<void> }
     */
    private verifyToken = async (omniHiveContext: GraphContext): Promise<void> => {
        // Retrieve the token worker
        const tokenWorker: ITokenWorker | undefined = global.omnihive.getWorker<ITokenWorker | undefined>(
            HiveWorkerType.Token
        );

        // Gather the security flag
        let disableSecurity: boolean =
            global.omnihive.getEnvironmentVariable<boolean>("OH_SECURITY_DISABLE_TOKEN_CHECK") ?? false;

        // If security is enabled and no worker is found then throw an error
        if (!disableSecurity && IsHelper.isNullOrUndefined(tokenWorker)) {
            // throw new Error("[ohAccessError] No token worker defined.");
        }

        // If security is enabled but the access token is blank then throw an error
        if (
            !disableSecurity &&
            !IsHelper.isNullOrUndefined(tokenWorker) &&
            (IsHelper.isNullOrUndefined(omniHiveContext) ||
                IsHelper.isNullOrUndefined(omniHiveContext.access) ||
                IsHelper.isEmptyStringOrWhitespace(omniHiveContext.access))
        ) {
            // throw new Error("[ohAccessError] Access token is invalid or expired.");
        }

        // If security is enabled and the access token is provided then verify the token
        if (
            !disableSecurity &&
            !IsHelper.isNullOrUndefined(tokenWorker) &&
            !IsHelper.isNullOrUndefined(omniHiveContext) &&
            !IsHelper.isNullOrUndefined(omniHiveContext.access) &&
            !IsHelper.isEmptyStringOrWhitespace(omniHiveContext.access)
        ) {
            const verifyToken: boolean = await AwaitHelper.execute(tokenWorker.verify(omniHiveContext.access));

            // If the token is invalid then throw an error
            if (!verifyToken) {
                // throw new Error("[ohAccessError] Access token is invalid or expired.");
            }
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
        this.queryStructure = this.getQueryStructure(
            resolveInfo.operation.selectionSet.selections.filter(
                (x) => (x as FieldNode).name.value === this.parentCall
            ) as FieldNode[],
            this.parentCall,
            0,
            this.fieldAliasMap
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
     * Generate a query structure from the graph query
     *
     * Structure Def:
     *      {
     *          [parentName: string]: {
     *              [childStructure: string]: Recursive Structure Def,
     *              columns: { name: string, alias: string },
     *              tableKey: string (camel case name of database table),
     *              tableAlias: string (database query alias),
     *              parentTableKey: string (camel case name of database table this object is linking from),
     *              linkingTableKey: string (camel case name of database table this object is linking to),
     *              args: any (arguments declared in graph),
     *          }
     *      }
     *
     * @param graphField Selection Field Nodes from the GraphQL Query Object
     * @param parentKey Current fields parent key
     * @param tableCount Current number of tables being joined upon
     * @param aliasKeys Alias keys of columns being selected
     * @returns { any }
     */
    private getQueryStructure = (
        graphField: readonly FieldNode[],
        parentKey: string,
        tableCount: number,
        aliasKeys: any
    ): any => {
        // Initiate default object
        let structure: any = {};

        // Iterate through each field in the selection node
        graphField.forEach((field) => {
            // Get all selections in the set
            const fieldSelections = field?.selectionSet?.selections;

            // If this field has a selection set then it is a join property
            if (fieldSelections && fieldSelections.length > 0) {
                // If the structure property does not exist for this field create it
                if (!structure[field.name.value]) {
                    structure[field.name.value] = {};
                }

                // Increment the table count
                tableCount++;

                // Recurse through the query builder for the current field values
                structure[field.name.value] = this.getQueryStructure(
                    fieldSelections as FieldNode[],
                    field.name.value,
                    tableCount,
                    aliasKeys
                );

                // Set the table alias
                structure[field.name.value].tableAlias = `t${tableCount}`;
            }

            // Else this is a database column
            else {
                // If the current structure does not have a column property initialize it
                if (!structure.columns) {
                    structure.columns = [];
                }

                // Create the Column object
                const fieldKeys: any = { name: field.name.value, alias: `f${this.columnCount}` };

                // Store the created column object into the necessary objects for reference
                aliasKeys.push(fieldKeys);
                structure.columns.push(fieldKeys);

                // Increment column count
                this.columnCount++;
            }

            // If the field name has the join identifier or the field name is the primary query function set needed properties
            if (field.name.value.endsWith(this.joinFieldSuffix) || field.name.value === this.parentCall) {
                // Set the table key as the field name with the join identifier removed
                const tableKey = field.name.value.replace(this.joinFieldSuffix, "");

                // If the schema sub-object for the table key exists this is a join to the parent table
                if (this.schema[tableKey]) {
                    // Set the structure's tableKey value as the current tableKey value
                    structure[field.name.value].tableKey = tableKey;

                    // Set the structure's parentTableKey property as the current parentKey value with the join identifier removed
                    structure[field.name.value].parentTableKey = parentKey.replace(this.joinFieldSuffix, "");
                }
                // Else this is a join to another table from the parent table
                else {
                    // Find the table being linked to and set the structure's tableKey property
                    structure[field.name.value].tableKey = this.schema[parentKey].find(
                        (x) => field.name.value.replace(this.joinFieldSuffix, "") === x.columnNameEntity
                    )?.columnForeignKeyTableNameCamelCase;
                    // Set the parent key as the linkingTableKey value
                    structure[field.name.value].linkingTableKey = parentKey;
                }
            }

            // Flatten the argument object to a readable form
            const args = this.flattenArgs(field.arguments as unknown as readonly ObjectFieldNode[]);

            // If arguments exists then store them in the structure's args property
            if (args && Object.keys(args).length > 0) {
                structure[field.name.value].args = args;
            }
        });

        // Return what was built
        return structure;
    };

    /**
     * Flatten the Argument nodes of the GraphQL Field query into a readable form
     *
     * @param args GraphQLs Argument Object
     * @returns { any }
     */
    private flattenArgs = (args: readonly ObjectFieldNode[]): any => {
        // Create default return object
        const flattened: any = {};

        // For each object in the GraphQL Argument array
        args.forEach((x) => {
            // If the value has a field array then recursively retrieving the arguments for it's values
            if ((x.value as ObjectValueNode)?.fields?.length > 0) {
                flattened[x.name.value] = this.flattenArgs((x.value as ObjectValueNode).fields);
            }
            // If the value has a value array
            else if ((x.value as ListValueNode)?.values?.length > 0) {
                // Set a default blank array in the return object
                flattened[x.name.value] = [];
                // Iterate through each value
                (x.value as ListValueNode).values.forEach((y) => {
                    // If the value has a field property that contains an array then recursively retrieving the arguments for it's values
                    if ((y as ObjectValueNode).fields?.length > 0) {
                        flattened[x.name.value].push(
                            this.flattenArgs((y as ObjectValueNode).fields as readonly ObjectFieldNode[])
                        );
                    }
                    // Else store its value inside the return object
                    else {
                        flattened[x.name.value].push((y as unknown as ObjectFieldNode).value);
                    }
                });
            }
            // Else store its values inside the return object
            else {
                flattened[x.name.value] = (x.value as unknown as ObjectFieldNode).value;
            }
        });

        // Return the flattened argument list
        return flattened;
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
            this.buildConditions(structure.args, structure.tableAlias, this.builder, parentKey);
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
                        primaryColumn.columnForeignKeyTableNameCamelCase
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
                                this.buildConditions(structure.args, structure.tableAlias, builder, tableKey, true);
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
                                this.buildConditions(structure.args, structure.tableAlias, builder, tableKey, true);
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
                                this.buildConditions(structure.args, structure.tableAlias, builder, tableKey, true);
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
                                this.buildConditions(structure.args, structure.tableAlias, builder, tableKey, true);
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
                                this.buildConditions(structure.args, structure.tableAlias, builder, tableKey, true);
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
                                this.buildConditions(structure.args, structure.tableAlias, builder, tableKey, true);
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
                                this.buildConditions(structure.args, structure.tableAlias, builder, tableKey, true);
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
                                this.buildConditions(structure.args, structure.tableAlias, builder, tableKey, true);
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
     * Build the database query conditional structure
     *
     * @param args Flattened argument list
     * @param tableAlias Table alias of the current table
     * @param builder Current database query builder
     * @param tableName Entity table name
     * @param join Flag to dictate this should be added to an on statement and not a where statement
     * @returns { void }
     */
    private buildConditions = (
        args: any,
        tableAlias: string,
        builder: Knex.QueryBuilder<any, unknown[]> | Knex.JoinClause,
        tableName: string,
        join: boolean = false
    ) => {
        // Iterate through the args' keys
        for (const knexFunction in args) {
            // Perform the related function depending on the key's value
            switch (knexFunction) {
                case "where": {
                    this.buildEqualities(args[knexFunction], tableAlias, builder, tableName, false, join);
                    break;
                }
                case "orderBy": {
                    this.buildOrderBy(args[knexFunction], tableAlias, tableName);
                    break;
                }
                case "groupBy": {
                    this.buildGroupBy(args[knexFunction], tableAlias, tableName);
                    break;
                }
            }
        }
    };

    /**
     * Build the equality arguments based on the current need
     *
     * @param arg Flattened argument object (sub-object of the calling functions args object)
     * @param tableAlias Table alias of the current table
     * @param builder Current database query builder
     * @param tableName Entity table name
     * @param having Flag to indicate this should be added to a having statement
     * @param join Flag to indicate this should be added to an on statement
     * @returns { void }
     */
    private buildEqualities = (
        arg: any,
        tableAlias: string,
        builder: Knex.QueryBuilder<any, unknown[]> | Knex.JoinClause,
        tableName: string,
        having: boolean = false,
        join: boolean = false
    ): void => {
        // If the builder is not properly initialized then throw an error
        if (!builder) {
            throw new Error("Knex Query Builder is not initialized");
        }

        // Iterate through each key of the arg object
        for (const key in arg) {
            // If the key is "and" then call this function again with it's sub-object with a sub-builder
            if (key === "and") {
                // if the join flag is passed in use the andOn sub-builder
                if (join) {
                    // Call this function again using the sub-builder and the arguments sub-object
                    (builder as Knex.JoinClause).andOn((subBuilder) => {
                        for (const innerArg of arg.and) {
                            this.buildEqualities(innerArg, tableAlias, subBuilder, tableName, false, join);
                        }
                    });
                } else {
                    // Call this function again using the and sub-builder and the arguments sub-object
                    (builder as Knex.QueryBuilder)[having ? "andHaving" : "andWhere"]((subBuilder) => {
                        for (const innerArg of arg.and) {
                            this.buildEqualities(innerArg, tableAlias, subBuilder, tableName, having);
                        }
                    });
                }
                continue;
            }

            // If the key is "or" then call this function again with it's sub-object with a sub-builder
            if (key === "or") {
                // If the join flag is passed in use the orOn sub-builder
                if (join) {
                    // Call this function again using the sub-builder and the arguments sub-object
                    (builder as Knex.JoinClause).orOn((subBuilder) => {
                        for (const innerArg of arg.or) {
                            this.buildEqualities(innerArg, tableAlias, subBuilder, tableName, false, join);
                        }
                    });
                } else {
                    // Call this function again using the or sub-builder and the arguments sub-object
                    (builder as Knex.QueryBuilder)[having ? "orHaving" : "orWhere"]((subBuilder) => {
                        for (const innerArg of arg.or) {
                            this.buildEqualities(innerArg, tableAlias, subBuilder, tableName, having);
                        }
                    });
                }
                continue;
            }

            // Find the database column name to be used in the database query
            const columnName = this.schema[tableName].find((c) => c.columnNameEntity === key)?.columnNameDatabase;

            // If the columnName is found then build the equality line of the database query for this column
            if (columnName) {
                this.buildRowEquality(`${tableAlias}.${columnName}`, arg[key], builder, having, join);
            }
        }
    };

    /**
     * Build the Equality check for the database query for this given column
     *
     * @param argName Database value for the column being compared
     * @param arg Flattened Argument Object
     * @param builder Current database query builder
     * @param having Flag to indicate this should be added to a having statement
     * @param join Flag to indicate this should be added to an on statement
     * @returns { void }
     */
    private buildRowEquality = (
        argName: string,
        arg: any,
        builder: Knex.QueryBuilder<any, unknown[]> | Knex.JoinClause,
        having: boolean = false,
        join: boolean = false
    ): void => {
        // If knex is not properly initialized then throw an error
        if (!this.knex) {
            throw new Error("Knex is not initialized");
        }

        // Iterate through each key in the arg object
        for (const equality in arg) {
            // Retrieve the value of the comparison
            let argValue = arg[equality];

            // If the argument value is an object that contains a subquery property then set the raw value as the argValue
            if (argValue.subquery) {
                argValue = this.knex.raw(`${argValue.subquery}`);
            }

            // If the join flag is set then use the raw values as the argValues
            if (join) {
                if (typeof argValue === "string") {
                    argValue = this.knex.raw(`'${argValue}'`);
                } else {
                    argValue = this.knex.raw(argValue);
                }
            }

            // If the argValue is a boolean then transform the value to their database equivalents
            if (typeof argValue === "boolean") {
                argValue = argValue ? 1 : 0;
            }

            // Build the equality segment of the database query
            switch (equality) {
                case "eq": {
                    // If the join flag is set build the on equality segment
                    if (join) {
                        (builder as Knex.JoinClause).on(argName, "=", argValue);
                    }
                    // If the having flag is set build the having equality segment
                    else if (having) {
                        (builder as Knex.QueryBuilder).having(argName, "=", argValue);
                    }
                    // Build the where equality segment by default
                    else {
                        (builder as Knex.QueryBuilder).where(argName, argValue);
                    }
                    break;
                }
                case "notEq": {
                    // If the join flag is set build the on equality segment
                    if (join) {
                        (builder as Knex.JoinClause).on(argName, "!=", argValue);
                    }
                    // If the having flag is set build the having equality segment
                    else if (having) {
                        (builder as Knex.QueryBuilder).having(argName, "!=", argValue);
                    }
                    // Build the where equality segment by default
                    else {
                        (builder as Knex.QueryBuilder).whereNot(argName, argValue);
                    }
                    break;
                }
                case "like": {
                    // If the join flag is set build the on equality segment
                    if (join) {
                        (builder as Knex.JoinClause).on(argName, "like", argValue);
                    }
                    // Build the having or where equality segment based on the having flag
                    else {
                        (builder as Knex.QueryBuilder)[having ? "having" : "where"](argName, "like", argValue);
                    }
                    break;
                }
                case "notLike": {
                    // If the join flag is set build the on equality segment
                    if (join) {
                        (builder as Knex.JoinClause).on(argName, "not like", argValue);
                    }
                    // If the having flag is set build the having equality segment
                    else if (having) {
                        (builder as Knex.QueryBuilder).having(argName, "not like", argValue);
                    }
                    // Build the where equality segment by default
                    else {
                        (builder as Knex.QueryBuilder).whereNot(argName, "like", argValue);
                    }
                    break;
                }
                case "gt": {
                    // If the join flag is set build the on equality segment
                    if (join) {
                        (builder as Knex.JoinClause).on(argName, ">", argValue);
                    }
                    // Build the having or where equality segment based on the having flag
                    else {
                        (builder as Knex.QueryBuilder)[having ? "having" : "where"](argName, ">", argValue);
                    }
                    break;
                }
                case "gte": {
                    // If the join flag is set build the on equality segment
                    if (join) {
                        (builder as Knex.JoinClause).on(argName, ">=", argValue);
                    }
                    // Build the having or where equality segment based on the having flag
                    else {
                        (builder as Knex.QueryBuilder)[having ? "having" : "where"](argName, ">=", argValue);
                    }
                    break;
                }
                case "notGt": {
                    // If the join flag is set build the on equality segment
                    if (join) {
                        (builder as Knex.JoinClause).on(argName, "<=", argValue);
                    }
                    // If the having flag is set build the having equality segment
                    else if (having) {
                        (builder as Knex.QueryBuilder).having(argName, "<=", argValue);
                    }
                    // Build the where equality segment by default
                    else {
                        (builder as Knex.QueryBuilder).whereNot(argName, ">", argValue);
                    }
                    break;
                }
                case "notGte": {
                    // If the join flag is set build the on equality segment
                    if (join) {
                        (builder as Knex.JoinClause).on(argName, "<", argValue);
                    }
                    // If the having flag is set build the having equality segment
                    else if (having) {
                        (builder as Knex.QueryBuilder).having(argName, "<", argValue);
                    }
                    // Build the where equality segment by default
                    else {
                        (builder as Knex.QueryBuilder).whereNot(argName, ">=", argValue);
                    }
                    break;
                }
                case "lt": {
                    // If the join flag is set build the on equality segment
                    if (join) {
                        (builder as Knex.JoinClause).on(argName, "<", argValue);
                    }
                    // Build the having or where equality segment based on the having flag
                    else {
                        (builder as Knex.QueryBuilder)[having ? "having" : "where"](argName, "<", argValue);
                    }
                    break;
                }
                case "lte": {
                    // If the join flag is set build the on equality segment
                    if (join) {
                        (builder as Knex.JoinClause).on(argName, "<=", argValue);
                    }
                    // Build the having or where equality segment based on the having flag
                    else {
                        (builder as Knex.QueryBuilder)[having ? "having" : "where"](argName, "<=", argValue);
                    }
                    break;
                }
                case "notLt": {
                    // If the join flag is set build the on equality segment
                    if (join) {
                        (builder as Knex.JoinClause).on(argName, ">=", argValue);
                    }
                    // If the having flag is set build the having equality segment
                    else if (having) {
                        (builder as Knex.QueryBuilder).having(argName, ">=", argValue);
                    }
                    // Build the where equality segment by default
                    else {
                        (builder as Knex.QueryBuilder).whereNot(argName, "<", argValue);
                    }
                    break;
                }
                case "notLte": {
                    // If the join flag is set build the on equality segment
                    if (join) {
                        (builder as Knex.JoinClause).on(argName, ">", argValue);
                    }
                    // If the having flag is set build the having equality segment
                    else if (having) {
                        (builder as Knex.QueryBuilder).having(argName, ">", argValue);
                    }
                    // Build the where equality segment by default
                    else {
                        (builder as Knex.QueryBuilder).whereNot(argName, "<=", argValue);
                    }
                    break;
                }
                case "in": {
                    // If the join flag is set build the on equality segment
                    if (join) {
                        (builder as Knex.JoinClause).onIn(argName, argValue);
                    }
                    // Build the having or where equality segment based on the having flag
                    else {
                        (builder as Knex.QueryBuilder)[having ? "havingIn" : "whereIn"](argName, argValue);
                    }
                    break;
                }
                case "notIn": {
                    // If the join flag is set build the on equality segment
                    if (join) {
                        (builder as Knex.JoinClause).onNotIn(argName, argValue);
                    }
                    // Build the having or where equality segment based on the having flag
                    else {
                        (builder as Knex.QueryBuilder)[having ? "havingNotIn" : "whereNotIn"](argName, argValue);
                    }
                    break;
                }
                case "isNull": {
                    // If the join flag is set build the on equality segment
                    if (join) {
                        (builder as Knex.JoinClause).onNull(argName);
                    }
                    // If the having flag is set build the having equality segment
                    else if (having) {
                        (builder as Knex.QueryBuilder).having(argName, "is", this.knex.raw("null"));
                    }
                    // Build the where equality segment by default
                    else {
                        (builder as Knex.QueryBuilder).whereNull(argName);
                    }
                    break;
                }
                case "isNotNull": {
                    // If the join flag is set build the on equality segment
                    if (join) {
                        (builder as Knex.JoinClause).onNotNull(argName);
                    }
                    // If the having flag is set build the having equality segment
                    else if (having) {
                        (builder as Knex.QueryBuilder).having(argName, "is not", this.knex.raw("null"));
                    }
                    // Build the where equality segment by default
                    else {
                        (builder as Knex.QueryBuilder).whereNotNull(argName);
                    }
                    break;
                }
                case "exists": {
                    // If the join flag is set build the on equality segment
                    if (join) {
                        (builder as Knex.JoinClause).onExists(argValue);
                    }
                    // If the having flag is set build the having equality segment
                    else if (having) {
                        throw new Error("The Having function does not support the exists equality");
                    }
                    // Build the where equality segment by default
                    else {
                        (builder as Knex.QueryBuilder).whereExists(argValue);
                    }
                    break;
                }
                case "notExists": {
                    // If the join flag is set build the on equality segment
                    if (join) {
                        (builder as Knex.JoinClause).onNotExists(argValue);
                    }
                    // If the having flag is set build the having equality segment
                    else if (having) {
                        throw new Error("The Having function does not support the notExists equality");
                    }
                    // Build the where equality segment by default
                    else {
                        (builder as Knex.QueryBuilder).whereNotExists(argValue);
                    }
                    break;
                }
                case "between": {
                    // If the join flag is set build the on equality segment
                    if (join) {
                        (builder as Knex.JoinClause).onBetween(argName, [argValue.start, argValue.end]);
                    }
                    // Build the having or where equality segment based on the having flag
                    else {
                        (builder as Knex.QueryBuilder)[having ? "havingBetween" : "whereBetween"](argName, [
                            argValue.start,
                            argValue.end,
                        ]);
                    }
                    break;
                }
                case "notBetween": {
                    // If the join flag is set build the on equality segment
                    if (join) {
                        (builder as Knex.JoinClause).onNotBetween(argName, [argValue.start, argValue.end]);
                    }
                    // Build the having or where equality segment based on the having flag
                    else {
                        (builder as Knex.QueryBuilder)[having ? "havingNotBetween" : "whereNotBetween"](argName, [
                            argValue.start,
                            argValue.end,
                        ]);
                    }
                    break;
                }
            }
        }
    };

    /**
     * Build the order by segment of the database query
     *
     * @param arg Flattened argument object
     * @param tableAlias Table alias of the current table
     * @param tableName Entity table name
     * @returns { void }
     */
    private buildOrderBy = (arg: any, tableAlias: string, tableName: string): void => {
        // Initiate an array to store the order by values in the given order
        const orderByArgs: { column: string; order: "asc" | "desc" }[] = [];

        // Iterate through each argument and build the order by array item
        for (const field of arg) {
            // Iterate through the argument item's keys
            Object.keys(field).map((key) => {
                // Retrieve the database name for the column
                const dbName = this.findDbName(key, tableName);

                // If the database name was found push the item into the order by array
                if (dbName) {
                    orderByArgs.push({ column: `${tableAlias}.${dbName}`, order: field[key] });
                }
            });
        }

        // Populate the order by segment in the database query
        this.builder?.orderBy(orderByArgs);
    };

    /**
     * Build the group by segment of the database query
     *
     * @param arg Flattened argument object
     * @param tableAlias Table alias of the current table
     * @param tableName Entity table name
     * @returns { void }
     */
    private buildGroupBy = (arg: { columns: string[]; having: any }, tableAlias: string, tableName: string): void => {
        // If the database query builder is not initialized properly then throw an error
        if (!this.builder) {
            throw new Error("Knex Query Builder is not initialized");
        }

        const dbNames: string[] = [];

        // if the the columns property is an array the iterate through each item
        // populating the dbNames array with the column's database name
        if (Array.isArray(arg.columns)) {
            arg.columns.forEach((x) => {
                const name = this.findDbName(x, tableName);
                if (name) {
                    dbNames.push(name);
                }
            });
        }
        // Else find the values database name and push the value into the dbNames array
        else {
            const name = this.findDbName(arg.columns, tableName);

            if (name) {
                dbNames.push(name);
            }
        }

        // Build the group by section of the database query
        this.builder.groupBy(dbNames);

        // If the arguments has the having property then build the having equalities
        if (arg.having) {
            this.buildEqualities(arg.having, tableAlias, this.builder, tableName, true);
        }
    };

    /**
     * Find the database name for a given column's entity name and table name
     *
     * @param fieldName Column's entity name
     * @param tableName The Column's table entity name
     * @returns
     */
    private findDbName = (fieldName: string, tableName: string) => {
        const name = this.schema[tableName].find((column) => column.columnNameEntity === fieldName)?.columnNameDatabase;

        return name;
    };

    /**
     * Build the graph object from the database return set
     *
     * @param structure Structure of the graph query object
     * @param results Sql result set
     * @returns { void }
     */
    private buildGraphReturn = (structure: any, results: any): void => {
        const condensedResults: any = [];

        // Iterate through each database result and build the graph return object
        results.forEach((dbItem: any) => {
            this.processRow(condensedResults, dbItem, structure);
        });

        this.graphReturn = condensedResults;
    };

    /**
     * Process a single database row result
     *
     * @param results Final result object
     * @param dbItem Single database result row
     * @param structure Structure of the graph query object
     * @returns { void }
     */
    private processRow = (results: any, dbItem: any, structure: any) => {
        let parent: any;

        // Get the return columns of the current structure level
        const columns: { name: string; alias: string }[] = structure.columns ?? [];

        // Get the joins of the current structure level
        const linkingKeys: string[] = Object.keys(structure).filter((x: string) => x.endsWith(this.joinFieldSuffix));

        if (results.length <= 0) {
            results.push({});
        }

        // Find any matching data at this structure level
        for (const item of results) {
            if (this.compareParentData(columns, item, dbItem)) {
                parent = item;
            }
        }

        // If a match exists then build onto the matching object
        if (parent) {
            this.buildDataFromRow(parent, dbItem, columns, linkingKeys, structure);
        }

        // Else create a new array entry
        else {
            if (Object.keys(results[results.length - 1]).length > 0) {
                results.push({});
            }

            this.buildDataFromRow(results[results.length - 1], dbItem, columns, linkingKeys, structure);
        }
    };

    /**
     * Build the Graph result object from the database result row
     *
     * @param item Matching results sub-object
     * @param dbItem Database result row
     * @param columns Desired return columns object array
     * @param linkingKeys Linking Property name of structure object
     * @param structure Structure of the graph query object
     * @returns { void }
     */
    private buildDataFromRow = (
        item: any,
        dbItem: any,
        columns: { name: string; alias: string }[],
        linkingKeys: string[],
        structure: any
    ): void => {
        // Build the graph return item for this structure level
        for (const col of columns) {
            if (!item[col.name]) {
                item[col.name] = dbItem[col.alias];
            }
        }

        // If a join exists then create a new property that is an empty array
        for (const key of linkingKeys) {
            if (!item[key]) {
                item[key] = [];
            }

            // Process the join on the next object level
            this.processRow(item[key], dbItem, structure[key]);
        }
    };

    /**
     * Find matching data for the database result row
     *
     * @param columns Desired return columns object array
     * @param item Current graph return object for this structure level and array index
     * @param dbItem
     * @returns { boolean }
     */
    private compareParentData = (columns: { name: string; alias: string }[], item: any, dbItem: any) => {
        // Iterate through each returning column
        for (const col of columns) {
            // if the item does not have that column property return false
            if (!item[col.name]) {
                return false;
            }
            // If the current return object does not match the database return object
            // for the given column then return false
            else if (item[col.name] !== dbItem[col.alias]) {
                return false;
            }
        }

        // If all conditions pass return true
        return true;
    };
}
