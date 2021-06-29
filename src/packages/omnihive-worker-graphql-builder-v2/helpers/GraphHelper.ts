import { FieldNode, ListValueNode, ObjectFieldNode, ObjectValueNode } from "graphql";
import { Knex } from "knex";
import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { ILogWorker } from "@withonevision/omnihive-core/interfaces/ILogWorker";
import { GraphContext } from "@withonevision/omnihive-core/models/GraphContext";
import { TableSchema } from "@withonevision/omnihive-core/models/TableSchema";
import { IDatabaseWorker } from "@withonevision/omnihive-core/interfaces/IDatabaseWorker";
import { IsHelper } from "@withonevision/omnihive-core/helpers/IsHelper";
import { IEncryptionWorker } from "@withonevision/omnihive-core/interfaces/IEncryptionWorker";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { ICacheWorker } from "@withonevision/omnihive-core/interfaces/ICacheWorker";
import { IDateWorker } from "@withonevision/omnihive-core/interfaces/IDateWorker";
import { ITokenWorker } from "@withonevision/omnihive-core/interfaces/ITokenWorker";

export class GraphHelper {
    private columnCount: number = 0;
    private joinFieldSuffix: string = "_table";

    public getGraphTypeFromDbType = (dbType: string): string => {
        switch (dbType) {
            case "money":
                return `Float`;
            case "bigint":
                return "Int";
            case "int":
                return `Int`;
            case "smallint":
                return `Int`;
            case "tinyint":
                return `Int`;
            case "float":
                return `Float`;
            case "decimal":
                return `Float`;
            case "numeric":
                return `Float`;
            case "nvarchar":
                return "String";
            case "varchar":
                return `String`;
            case "nchar":
                return `String`;
            case "text":
                return `String`;
            case "varbinary":
                return `String`;
            case "binary":
                return `String`;
            case "datetime":
                return `String`;
            case "date":
                return "String";
            case "time":
                return `String`;
            case "uniqueidentifier":
                return `String`;
            case "bit":
                return "Boolean";
            default:
                return `String`;
        }
    };

    /**
     *
     * Setup Helpers
     *
     */
    //#region Setup Helpers

    /**
     * Set the required workers for the parser
     *
     * @param workerName
     * @returns { any }
     */
    public getRequiredWorkers = (workerName: string): any => {
        let logWorker, databaseWorker, knex, encryptionWorker, cacheWorker, dateWorker;

        // Set the log worker
        logWorker = global.omnihive.getWorker<ILogWorker | undefined>(HiveWorkerType.Log);

        // If the log worker does not exist then throw an error
        if (IsHelper.isNullOrUndefined(logWorker)) {
            throw new Error("Log Worker Not Defined.  This graph converter will not work without a Log worker.");
        }

        // Set the database worker
        databaseWorker = global.omnihive.getWorker<IDatabaseWorker | undefined>(HiveWorkerType.Database, workerName);

        // If the database worker does not exist then throw an error
        if (IsHelper.isNullOrUndefined(databaseWorker)) {
            throw new Error(
                "Database Worker Not Defined.  This graph converter will not work without a Database worker."
            );
        }
        // Set the knex object from the database worker
        knex = databaseWorker.connection as Knex;

        // Set the encryption worker
        encryptionWorker = global.omnihive.getWorker<IEncryptionWorker | undefined>(HiveWorkerType.Encryption);

        // If the encryption worker does not exist then throw an error
        if (IsHelper.isNullOrUndefined(encryptionWorker)) {
            throw new Error(
                "Encryption Worker Not Defined.  This graph converter with Cache worker enabled will not work without an Encryption worker."
            );
        }

        cacheWorker = global.omnihive.getWorker<ICacheWorker | undefined>(HiveWorkerType.Cache);
        dateWorker = global.omnihive.getWorker<IDateWorker | undefined>(HiveWorkerType.Date);

        return { logWorker, databaseWorker, knex, encryptionWorker, cacheWorker, dateWorker };
    };

    /**
     * Verify the access token provided is valid
     *
     * @param omniHiveContext GraphQL Custom Headers
     * @returns { Promise<void> }
     */
    public verifyToken = async (omniHiveContext: GraphContext): Promise<void> => {
        // Retrieve the token worker
        const tokenWorker: ITokenWorker | undefined = global.omnihive.getWorker<ITokenWorker | undefined>(
            HiveWorkerType.Token
        );

        // Gather the security flag
        let disableSecurity: boolean =
            global.omnihive.getEnvironmentVariable<boolean>("OH_SECURITY_DISABLE_TOKEN_CHECK") ?? false;

        // If security is enabled and no worker is found then throw an error
        if (!disableSecurity && IsHelper.isNullOrUndefined(tokenWorker)) {
            throw new Error("[ohAccessError] No token worker defined.");
        }

        // If security is enabled but the access token is blank then throw an error
        if (
            !disableSecurity &&
            !IsHelper.isNullOrUndefined(tokenWorker) &&
            (IsHelper.isNullOrUndefined(omniHiveContext) ||
                IsHelper.isNullOrUndefined(omniHiveContext.access) ||
                IsHelper.isEmptyStringOrWhitespace(omniHiveContext.access))
        ) {
            throw new Error("[ohAccessError] Access token is invalid or expired.");
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
                throw new Error("[ohAccessError] Access token is invalid or expired.");
            }
        }
    };
    //#endregion

    /**
     *
     * Query Schema Helpers
     *
     */

    //#region Query Schema Helpers

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
    public buildQueryStructure = (
        graphField: readonly FieldNode[],
        parentKey: string,
        tableCount: number,
        aliasKeys: any,
        parentCall: string,
        schema: { [tableName: string]: TableSchema[] }
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
                structure[field.name.value] = this.buildQueryStructure(
                    fieldSelections as FieldNode[],
                    field.name.value,
                    tableCount,
                    aliasKeys,
                    parentCall,
                    schema
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
            if (field.name.value.endsWith(this.joinFieldSuffix) || field.name.value === parentCall) {
                // Set the table key as the field name with the join identifier removed
                const tableKey = field.name.value.replace(this.joinFieldSuffix, "");

                // If the schema sub-object for the table key exists this is a join to the parent table
                if (schema[tableKey]) {
                    // Set the structure's tableKey value as the current tableKey value
                    structure[field.name.value].tableKey = tableKey;

                    // Set the structure's parentTableKey property as the current parentKey value with the join identifier removed
                    structure[field.name.value].parentTableKey = parentKey.replace(this.joinFieldSuffix, "");
                }
                // Else this is a join to another table from the parent table
                else {
                    // Find the table being linked to and set the structure's tableKey property
                    structure[field.name.value].tableKey = schema[parentKey].find(
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
    //#endregion

    /**
     *
     * Hydrator
     *
     */

    //#region Hydrator

    /**
     * Build the graph object from the database return set
     *
     * @param structure Structure of the graph query object
     * @param results Sql result set
     * @returns { any }
     */
    public buildGraphReturn = (structure: any, results: any, dateWorker: IDateWorker | undefined): any => {
        const condensedResults: any = [];

        // Iterate through each database result and build the graph return object
        results.forEach((dbItem: any) => {
            this.processRow(condensedResults, dbItem, structure, dateWorker);
        });

        return condensedResults;
    };

    /**
     * Process a single database row result
     *
     * @param results Final result object
     * @param dbItem Single database result row
     * @param structure Structure of the graph query object
     * @returns { void }
     */
    private processRow = (results: any, dbItem: any, structure: any, dateWorker: IDateWorker | undefined) => {
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
            this.buildDataFromRow(parent, dbItem, columns, linkingKeys, structure, dateWorker);
        }

        // Else create a new array entry
        else {
            if (Object.keys(results[results.length - 1]).length > 0) {
                results.push({});
            }

            this.buildDataFromRow(results[results.length - 1], dbItem, columns, linkingKeys, structure, dateWorker);
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
        structure: any,
        dateWorker: IDateWorker | undefined
    ): void => {
        // Build the graph return item for this structure level
        for (const col of columns) {
            if (!item[col.name]) {
                let dbItemValue: any = dbItem[col.alias];

                if (IsHelper.isDate(dbItemValue) && dateWorker) {
                    dbItemValue = dateWorker.getFormattedDateString(dbItemValue);
                }

                item[col.name] = dbItemValue;
            }
        }

        // If a join exists then create a new property that is an empty array
        for (const key of linkingKeys) {
            if (!item[key]) {
                item[key] = [];
            }

            // Process the join on the next object level
            this.processRow(item[key], dbItem, structure[key], dateWorker);
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

    //#endregion

    /**
     *
     * Where, Order By, Group By Builders
     *
     */

    //#region Conditional Builder

    /**
     * Build the database query conditional structure
     *
     * @param args Flattened argument list
     * @param tableAlias Table alias of the current table
     * @param builder Current database query builder
     * @param tableName Entity table name
     * @param schema Database Schema
     * @param knex Database query builder parent object
     * @param join Flag to dictate this should be added to an on statement and not a where statement
     * @returns { void }
     */
    public buildConditions = (
        args: any,
        tableAlias: string,
        builder: Knex.QueryBuilder<any, unknown[]> | Knex.JoinClause,
        tableName: string,
        schema: { [tableName: string]: TableSchema[] },
        knex: Knex | undefined,
        join: boolean = false
    ) => {
        // If knex is not properly initialized then throw an error
        if (!knex) {
            throw new Error("Knex is not initialized");
        }

        // Iterate through the args' keys
        for (const knexFunction in args) {
            // Perform the related function depending on the key's value
            switch (knexFunction) {
                case "where": {
                    this.buildEqualities(args[knexFunction], tableAlias, builder, tableName, schema, knex, false, join);
                    break;
                }
                case "orderBy": {
                    this.buildOrderBy(
                        args[knexFunction],
                        tableAlias,
                        tableName,
                        builder as Knex.QueryBuilder<any, unknown[]>,
                        schema
                    );
                    break;
                }
                case "groupBy": {
                    this.buildGroupBy(
                        args[knexFunction],
                        tableAlias,
                        tableName,
                        builder as Knex.QueryBuilder<any, unknown[]>,
                        schema,
                        knex
                    );
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
        schema: { [tableName: string]: TableSchema[] },
        knex: Knex,
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
                            this.buildEqualities(
                                innerArg,
                                tableAlias,
                                subBuilder,
                                tableName,
                                schema,
                                knex,
                                false,
                                join
                            );
                        }
                    });
                } else {
                    // Call this function again using the and sub-builder and the arguments sub-object
                    (builder as Knex.QueryBuilder)[having ? "andHaving" : "andWhere"]((subBuilder) => {
                        for (const innerArg of arg.and) {
                            this.buildEqualities(innerArg, tableAlias, subBuilder, tableName, schema, knex, having);
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
                            this.buildEqualities(
                                innerArg,
                                tableAlias,
                                subBuilder,
                                tableName,
                                schema,
                                knex,
                                false,
                                join
                            );
                        }
                    });
                } else {
                    // Call this function again using the or sub-builder and the arguments sub-object
                    (builder as Knex.QueryBuilder)[having ? "orHaving" : "orWhere"]((subBuilder) => {
                        for (const innerArg of arg.or) {
                            this.buildEqualities(innerArg, tableAlias, subBuilder, tableName, schema, knex, having);
                        }
                    });
                }
                continue;
            }

            // Find the database column name to be used in the database query
            const columnName = schema[tableName].find((c) => c.columnNameEntity === key)?.columnNameDatabase;

            // If the columnName is found then build the equality line of the database query for this column
            if (columnName) {
                this.buildRowEquality(`${tableAlias}.${columnName}`, arg[key], builder, knex, having, join);
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
        knex: Knex,
        having: boolean = false,
        join: boolean = false
    ): void => {
        // Iterate through each key in the arg object
        for (const equality in arg) {
            // Retrieve the value of the comparison
            let argValue = arg[equality];

            // If the argument value is an object that contains a subquery property then set the raw value as the argValue
            if (argValue.subquery) {
                argValue = knex.raw(`${argValue.subquery}`);
            }

            // If the join flag is set then use the raw values as the argValues
            if (join) {
                if (typeof argValue === "string") {
                    argValue = knex.raw(`'${argValue}'`);
                } else {
                    argValue = knex.raw(argValue);
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
                        (builder as Knex.QueryBuilder).having(argName, "is", knex.raw("null"));
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
                        (builder as Knex.QueryBuilder).having(argName, "is not", knex.raw("null"));
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
    private buildOrderBy = (
        arg: any,
        tableAlias: string,
        tableName: string,
        builder: Knex.QueryBuilder<any, unknown[]>,
        schema: { [tableName: string]: TableSchema[] }
    ): void => {
        // Initiate an array to store the order by values in the given order
        const orderByArgs: { column: string; order: "asc" | "desc" }[] = [];

        // Iterate through each argument and build the order by array item
        for (const field of arg) {
            // Iterate through the argument item's keys
            Object.keys(field).map((key) => {
                // Retrieve the database name for the column
                const dbName = this.findDbName(key, tableName, schema);

                // If the database name was found push the item into the order by array
                if (dbName) {
                    orderByArgs.push({ column: `${tableAlias}.${dbName}`, order: field[key] });
                }
            });
        }

        // Populate the order by segment in the database query
        builder.orderBy(orderByArgs);
    };

    /**
     * Build the group by segment of the database query
     *
     * @param arg Flattened argument object
     * @param tableAlias Table alias of the current table
     * @param tableName Entity table name
     * @returns { void }
     */
    private buildGroupBy = (
        arg: { columns: string[]; having: any },
        tableAlias: string,
        tableName: string,
        builder: Knex.QueryBuilder<any, unknown[]>,
        schema: { [tableName: string]: TableSchema[] },
        knex: Knex
    ): void => {
        // If the database query builder is not initialized properly then throw an error
        if (!builder) {
            throw new Error("Knex Query Builder is not initialized");
        }

        const dbNames: string[] = [];

        // if the the columns property is an array the iterate through each item
        // populating the dbNames array with the column's database name
        if (Array.isArray(arg.columns)) {
            arg.columns.forEach((x) => {
                const name = this.findDbName(x, tableName, schema);
                if (name) {
                    dbNames.push(name);
                }
            });
        }
        // Else find the values database name and push the value into the dbNames array
        else {
            const name = this.findDbName(arg.columns, tableName, schema);

            if (name) {
                dbNames.push(name);
            }
        }

        // Build the group by section of the database query
        builder.groupBy(dbNames);

        // If the arguments has the having property then build the having equalities
        if (arg.having) {
            this.buildEqualities(arg.having, tableAlias, builder, tableName, schema, knex, true);
        }
    };

    /**
     * Find the database name for a given column's entity name and table name
     *
     * @param fieldName Column's entity name
     * @param tableName The Column's table entity name
     * @returns
     */
    private findDbName = (fieldName: string, tableName: string, schema: { [tableName: string]: TableSchema[] }) => {
        const name = schema[tableName].find((column) => column.columnNameEntity === fieldName)?.columnNameDatabase;

        return name;
    };
    //#endregion
}
