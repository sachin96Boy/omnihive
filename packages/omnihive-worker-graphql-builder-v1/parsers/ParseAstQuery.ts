import { HiveWorkerType } from "@withonevision/omnihive-hive-common/enums/HiveWorkerType";
import { OmniHiveLogLevel } from "@withonevision/omnihive-hive-common/enums/OmniHiveLogLevel";
import { AwaitHelper } from "@withonevision/omnihive-hive-common/helpers/AwaitHelper";
import { StringHelper } from "@withonevision/omnihive-hive-common/helpers/StringHelper";
import { ConverterSqlInfo } from "@withonevision/omnihive-hive-common/models/ConverterSqlInfo";
import { HiveWorkerFactory } from "@withonevision/omnihive-hive-worker/HiveWorkerFactory";
import { ICacheWorker } from "@withonevision/omnihive-hive-worker/interfaces/ICacheWorker";
import { IDateWorker } from "@withonevision/omnihive-hive-worker/interfaces/IDateWorker";
import { IEncryptionWorker } from "@withonevision/omnihive-hive-worker/interfaces/IEncryptionWorker";
import { IKnexDatabaseWorker } from "@withonevision/omnihive-hive-worker/interfaces/IKnexDatabaseWorker";
import { ILogWorker } from "@withonevision/omnihive-hive-worker/interfaces/ILogWorker";
import { FieldNode, GraphQLArgument, GraphQLField, GraphQLFieldMap, GraphQLList, GraphQLObjectType, GraphQLResolveInfo, SelectionNode } from "graphql";
import knex from "knex";
import { GraphHelper } from "../helpers/GraphHelper";
import { ConverterDatabaseTable } from "../models/ConverterDatabaseTable";
import { ConverterOrderBy } from "../models/ConverterOrderBy";
import _ from "lodash";
import { TableSchema } from "@withonevision/omnihive-hive-common/models/TableSchema";
import { IFileSystemWorker } from "@withonevision/omnihive-hive-worker/interfaces/IFileSystemWorker";
import { OmniHiveConstants } from "@withonevision/omnihive-hive-common/models/OmniHiveConstants";

export class ParseAstQuery {

    private logWorker!: ILogWorker;
    private databaseWorker!: IKnexDatabaseWorker;
    private encryptionWorker!: IEncryptionWorker;
    private fileSystemWorker!: IFileSystemWorker;
    private cacheWorker!: ICacheWorker | undefined;
    private dateWorker!: IDateWorker | undefined;
    private parentPath!: GraphQLField<any, any>;
    private query!: knex.QueryBuilder;
    private currentTableIndex: number = 0;
    private currentFieldIndex: number = 0;
    private tables: ConverterDatabaseTable[] = [];
    private orderByList: ConverterOrderBy[] = [];
    private objPagination: { key: string, tableName: string, limit: number, page: number }[] = [];
    private whereHitCounter: number = 0;

    public parse = async (workerName: string, resolveInfo: GraphQLResolveInfo, cacheSetting: string, cacheTime: string): Promise<any> => {

        const fileSystemWorker: IFileSystemWorker | undefined = await AwaitHelper.execute<IFileSystemWorker | undefined>(
            HiveWorkerFactory.getInstance().getHiveWorker<IFileSystemWorker | undefined>(HiveWorkerType.FileSystem));

        if (!fileSystemWorker) {
            throw new Error("FileSystem Worker Not Defined.  This graph converter will not work without a FileSystem worker.");
        }

        const logWorker: ILogWorker | undefined = await AwaitHelper.execute<ILogWorker | undefined>(
            HiveWorkerFactory.getInstance().getHiveWorker<ILogWorker | undefined>(HiveWorkerType.Log));

        if (!logWorker) {
            throw new Error("Log Worker Not Defined.  This graph converter will not work without a Log worker.");
        }

        const databaseWorker: IKnexDatabaseWorker | undefined = await AwaitHelper.execute<IKnexDatabaseWorker | undefined>(
            HiveWorkerFactory.getInstance().getHiveWorker<IKnexDatabaseWorker | undefined>(HiveWorkerType.Database, workerName));

        if (!databaseWorker) {
            throw new Error("FileSystem Worker Not Defined.  This graph converter will not work without a FileSystem worker.");
        }

        const encryptionWorker: IEncryptionWorker | undefined = await AwaitHelper.execute<IEncryptionWorker | undefined>(
            HiveWorkerFactory.getInstance().getHiveWorker<IEncryptionWorker | undefined>(HiveWorkerType.Encryption));

        if (!encryptionWorker) {
            throw new Error("Encryption Worker Not Defined.  This graph converter with Cache worker enabled will not work without an Encryption worker.");
        }

        this.cacheWorker = await AwaitHelper.execute<ICacheWorker | undefined>(
            HiveWorkerFactory.getInstance().getHiveWorker<ICacheWorker | undefined>(HiveWorkerType.Cache));

        this.dateWorker = await AwaitHelper.execute<IDateWorker | undefined>(
            HiveWorkerFactory.getInstance().getHiveWorker<IDateWorker | undefined>(HiveWorkerType.Date));

        this.logWorker = logWorker;
        this.databaseWorker = databaseWorker;
        this.encryptionWorker = encryptionWorker;
        this.fileSystemWorker = fileSystemWorker;

        const converterInfo: ConverterSqlInfo = await this.getSqlFromGraph(resolveInfo);

        let cacheKey: string = "";
        let cacheSeconds = -1;

        if (this.cacheWorker) {
            if (cacheTime) {
                try {
                    cacheSeconds = +cacheTime;
                } catch {
                    cacheSeconds = -1;
                }
            }

            if (!StringHelper.isNullOrWhiteSpace(cacheSetting) && cacheSetting !== "none") {
                cacheKey = this.encryptionWorker.base64Encode(workerName + "||||" + converterInfo.sql);
            }

            if (!StringHelper.isNullOrWhiteSpace(cacheSetting) && cacheSetting === "cache") {

                const keyExists: boolean = await this.cacheWorker.exists(cacheKey);

                if (keyExists) {
                    this.logWorker.write(OmniHiveLogLevel.Debug, `(Retrieved from Cache) => ${workerName} => ${converterInfo.sql}`);
                    const cacheResults: string | undefined = await this.cacheWorker.get(cacheKey);

                    try {
                        if (cacheResults && !StringHelper.isNullOrWhiteSpace(cacheResults)) {
                            return JSON.parse(cacheResults);
                        }
                    }
                    catch {
                        cacheSetting = "cacheRefresh";
                    }
                }
            }
        }

        const dataResults: any[][] = await AwaitHelper.execute<any[][]>(this.databaseWorker.executeQuery(converterInfo.sql));
        const treeResults: any = this.getGraphFromData(dataResults[0], converterInfo.hydrationDefinition);

        if (this.cacheWorker) {
            if (!StringHelper.isNullOrWhiteSpace(cacheSetting) && cacheSetting !== "none") {
                this.logWorker.write(OmniHiveLogLevel.Debug, `(Written to Cache) => ${workerName} => ${converterInfo.sql}`);
                this.cacheWorker.set(cacheKey, JSON.stringify(treeResults), cacheSeconds);
            }
        }

        return treeResults;

    }

    private getGraphFromData = async (dataResults: any, hydrationDefinition: any): Promise<any> => {

        // Build the definition array from the hydrate definition and
        // map back to the original graph.

        const definition: any[] = [];
        definition.push(hydrationDefinition);

        const hydrator = new GraphHelper();
        const hydratedData = hydrator.nestHydrate(dataResults, definition);

        for (const data of hydratedData) {
            this.paginateSubObjects(data);

            for (const key in data) {
                // eslint-disable-next-line no-prototype-builtins
                if (data.hasOwnProperty(key)
                    && Object.prototype.toString.call(data[key]) === '[object Date]' && this.dateWorker) {
                    data[key] = this.dateWorker.getFormattedDateString(data[key]);
                }
            }
        }

        return hydratedData;
    }

    private getSqlFromGraph = async (resolveInfo: GraphQLResolveInfo): Promise<ConverterSqlInfo> => {

        // Get the parent type and the return type to resolve table info
        this.parentPath = _.get(resolveInfo.parentType.getFields(), resolveInfo.fieldNodes[0].name.value);
        const graphReturnType: GraphQLObjectType = (resolveInfo.returnType as GraphQLList<GraphQLObjectType>).ofType;
        const graphParentType: GraphQLObjectType = (this.parentPath.type as GraphQLList<GraphQLObjectType>).ofType;

        this.query = this.databaseWorker.connection.queryBuilder();

        // Build the root table
        const currentTable: ConverterDatabaseTable = {
            index: this.currentTableIndex,
            graphPath: "",
            tableAlias: `t${this.currentTableIndex}`,
            tableName: graphParentType.extensions?.dbTableName,
        };

        this.tables.push(currentTable);

        // Set the intial "from" clause
        this.query.from(`${graphParentType.extensions?.dbTableName} as t${this.currentTableIndex}`);

        // Get the main primary key from the root "from" table
        const primaryKey: any = _.filter(graphParentType.getFields(), (field) => {
            return field.extensions?.dbColumnName === graphParentType.extensions?.dbPrimaryKey;
        })[0];

        // Build the root where arguments and get the where string
        const args: any = {};

        Object.keys(resolveInfo.variableValues).forEach((key: string) => {
            const graphKey = key.replace(/^_.*_/, "");

            if (graphKey !== "dbPage" && graphKey !== "dbLimit"
                && graphKey !== "objPage" && graphKey !== "objLimit"
                && !graphReturnType.extensions?.aggregateType) {
                const dbColumnName = _.filter(graphReturnType.getFields(), (field: GraphQLField<any, any>) => field.name === graphKey)[0].extensions?.dbColumnName;
                args[dbColumnName] = resolveInfo.variableValues[key];
            } else if (graphReturnType.extensions?.aggregateType) {
                const dbColumnName = this.parentPath.args.filter((arg: GraphQLArgument) => arg.name === graphKey)[0]?.extensions?.dbColumnName;
                args[dbColumnName] = resolveInfo.variableValues[key];
            }
            else {
                args[graphKey] = resolveInfo.variableValues[key];
            }
        });


        this.whereOrderByHandler(graphParentType.extensions?.dbTableName, `t${this.currentTableIndex}`, args);

        // Push the root table into the iterator
        // Iterator is recursive so it should grab everything
        const hydrationDefinition: any = this.turnGraphNodeIntoSql(
            resolveInfo.fieldNodes[0].selectionSet?.selections ?? [],
            graphReturnType.getFields(),
            primaryKey,
            args);

        // Handle orderBy
        if (this.orderByList.length > 0) {
            this.query.orderBy(this.orderByList);
        }

        return {
            workerName: this.databaseWorker.config.name,
            sql: this.query.toString(),
            hydrationDefinition,
        };
    }

    private paginateSubObjects = (data: any) => {
        for (const key in data) {
            // eslint-disable-next-line no-prototype-builtins
            if (data.hasOwnProperty(key)) {
                if (this.objPagination.some(x => x.key === key)) {
                    const pageObject = this.objPagination.find(x => x.key === key);
                    if (pageObject) {
                        data[key] = data[key].slice(
                            (pageObject.page - 1) * pageObject.limit,
                            pageObject.page * pageObject.limit);
                    }
                }
                if (Array.isArray(data[key])) {
                    for (const subData of data[key]) {
                        this.paginateSubObjects(subData);
                    }
                }
            }
        }
    }

    private turnGraphNodeIntoSql = (selections: readonly SelectionNode[], selectionFields: GraphQLFieldMap<any, any>, primaryKey: any, args: any, parentTable?: ConverterDatabaseTable): any => {

        // Set up return hydration object
        const returnHydration: any = {};

        // Get max limit
        const maxLimitSetting = this.databaseWorker.config.metadata.rowLimit;
        let maxLimit: number = 100000;

        if (maxLimitSetting && typeof maxLimitSetting === "number" && +maxLimitSetting !== 0) {
            maxLimit = +maxLimitSetting;
        }

        // Handle first pass
        if (!parentTable) {
            let pageNumber = 1;

            _.forOwn(args, (value: any, key: any) => {
                if (key === "dbLimit") {
                    maxLimit = value;
                }

                if (key === "dbPage") {
                    pageNumber = value;
                }

                if (key === "objLimit") {
                    throw Error("Only subqueries can contain the objLimit argument. Use dbLimit to limit the main query table.");
                }

                if (key === "objPage") {
                    throw Error("Only subqueries can contain the objPage argument. Use dbPage to go to the page of the main query table.");
                }
            });

            this.query.limit(maxLimit);
            this.query.offset((pageNumber - 1) * maxLimit);

            parentTable = this.tables[0];
        }

        // Get table for reference
        const table: ConverterDatabaseTable = this.tables[this.currentTableIndex];

        // Primary key must ALWAYS be pushed in for every table so the hydrator will
        // work.  It must also be pushed in FIRST.  We will ignore the primary key
        // later if the query has requested it.

        const graphParentType: GraphQLObjectType = (this.parentPath.type as GraphQLList<GraphQLObjectType>).ofType;

        if (!graphParentType.extensions?.aggregateType) {
            returnHydration[primaryKey.name] = { column: `f${this.currentFieldIndex}`, id: true };
            this.query.select(`${table.tableAlias}.${primaryKey.extensions.dbColumnName} as f${this.currentFieldIndex}`);
            this.currentFieldIndex++;

            // Get the selection fields that are actual fields, push them into the catcher interface,
            // and add them to the select.  Ignore the primary key if it is in the query.
            const fields: SelectionNode[] = selections.filter((selection: SelectionNode) => (selection as FieldNode).selectionSet === undefined);

            fields.forEach((selection: SelectionNode) => {

                const graphField: GraphQLField<any, any> = _.get(selectionFields, (selection as FieldNode).name.value);

                if (graphField.extensions?.dbColumnName !== primaryKey.extensions.dbColumnName) {
                    returnHydration[graphField.name] = { column: `f${this.currentFieldIndex}` };
                    this.query.select(`${table.tableAlias}.${graphField.extensions?.dbColumnName} as f${this.currentFieldIndex}`);
                    this.currentFieldIndex++;
                }
            });
        } else {
            const aggTypes: SelectionNode[] = selections.filter((sel: SelectionNode) => !(sel as FieldNode).name.value.startsWith("to") && !(sel as FieldNode).name.value.startsWith("from"));

            aggTypes.forEach((agg: SelectionNode) => {
                const aggFieldNode: FieldNode = (agg as FieldNode);

                if (aggFieldNode.arguments && aggFieldNode.arguments.length > 1) {
                    throw new Error("Only one argument allowed for aggregate functions.");
                } else {
                    const knexFunctionField: GraphQLField<any, any> = _.filter(selectionFields, (field) => field.name === aggFieldNode.name.value)[0];
                    const knexFunction: string = knexFunctionField.extensions?.knexFunction;

                    const dbFieldName = knexFunctionField.args.filter((arg) => {
                        if (aggFieldNode && aggFieldNode.arguments && aggFieldNode.arguments.length > 0) {
                            return arg.name === aggFieldNode.arguments[0].name.value;
                        } else {
                            return undefined;
                        }
                    })[0].extensions?.dbColumnName;

                    if (knexFunction !== "count" && !dbFieldName) {
                        throw new Error("This aggregate function requires one argument.");
                    } else {
                        returnHydration[knexFunction] = { column: `f${this.currentFieldIndex}` };

                        const aggString: string = `${dbFieldName ? (table.tableAlias + "." + dbFieldName) : '*'} as f${this.currentFieldIndex}`;

                        switch (knexFunction) {
                            case "count":
                                this.query.count(aggString);
                                break;
                            case "countDistinct":
                                this.query.countDistinct(aggString);
                                break;
                            case "min":
                                this.query.min(aggString);
                                break;
                            case "max":
                                this.query.max(aggString);
                                break;
                            case "sum":
                                this.query.sum(aggString);
                                break;
                            case "sumDistinct":
                                this.query.sumDistinct(aggString);
                                break;
                            case "avg":
                                this.query.avg(aggString);
                                break;
                            case "avgDistinct":
                                this.query.avgDistinct(aggString);
                                break;
                        }

                        this.currentFieldIndex++;
                    }
                }
            });
        }

        // Get the selection fields that are joins
        const subTables: SelectionNode[] = selections.filter((selection: SelectionNode) => (selection as FieldNode).selectionSet !== undefined);

        if (subTables && subTables.length > 0) {
            this.currentTableIndex++;
        }

        subTables.forEach((selection: SelectionNode) => {
            const graphField: GraphQLField<any, any> = _.get(selectionFields, `${(selection as FieldNode).name.value}`);

            // Get all the subfields.  Different permutation if it is a many to one or one to many
            let subFields: GraphQLFieldMap<any, any> = {};

            if (graphField.type instanceof GraphQLList) {
                subFields = (graphField.type as GraphQLList<GraphQLObjectType>).ofType.getFields();  // One to many from GraphQLList
            } else if (graphField.type instanceof GraphQLObjectType) {
                subFields = graphField.type.getFields(); // Many to one from GraphQLObject
            }

            // Grab the join's primary key for the recursion
            const subPrimaryKey: any = _.filter(subFields, (field: any) => {
                return field.extensions.dbColumnName !== undefined &&
                    !field.name.toString().startsWith("from_") &&
                    !field.name.toString().startsWith("to_") &&
                    field.extensions.dbColumnName === graphField.extensions?.dbJoinForeignTablePrimaryKey;
            })[0];

            // Push into the catcher interface
            const subTable: ConverterDatabaseTable = {
                index: this.currentTableIndex,
                graphPath: parentTable?.graphPath === "" ? graphField.name : parentTable?.graphPath + "." + graphField.name,
                tableAlias: `t${this.currentTableIndex}`,
                tableName: graphField.extensions?.dbTableName,
            };

            this.tables.push(subTable);

            // Build the join based off of the field properties
            if (graphField.name.toString().startsWith("from_")) {
                this.query.leftJoin(
                    `${graphField.extensions?.dbTableName} as t${this.currentTableIndex}`,
                    `${parentTable?.tableAlias}.${graphField.extensions?.dbJoinForeignColumn}`,
                    `t${this.currentTableIndex}.${graphField.extensions?.dbJoinPrimaryColumn}`);
            }

            if (graphField.name.toString().startsWith("to_")) {
                this.query.leftJoin(
                    `${graphField.extensions?.dbTableName} as t${this.currentTableIndex}`,
                    `${parentTable?.tableAlias}.${graphField.extensions?.dbJoinPrimaryColumn}`,
                    `t${this.currentTableIndex}.${graphField.extensions?.dbJoinForeignColumn}`);
            }

            // Since we're in a "subtable", there could be arguments (where, orderby, etc), so build those
            const subArgs: any = {};

            _.forEach((selection as FieldNode).arguments, (arg: any) => {
                let dbColumnName: string = "";
                if (graphField.extensions?.aggregateType) {
                    dbColumnName = graphField.args.filter((field: GraphQLArgument) => field.name === arg.name.value)[0].extensions?.dbColumnName;
                }
                else {
                    if (graphField.name.toString().startsWith("from_") && arg.name.value !== "objPage" && arg.name.value !== "objLimit") {
                        dbColumnName = _.filter((graphField.type as GraphQLList<GraphQLObjectType>).ofType.getFields(), (field: GraphQLField<any, any>) => field.name === arg.name.value)[0].extensions?.dbColumnName;
                    }

                    if (graphField.name.toString().startsWith("to_") && arg.name.value !== "objPage" && arg.name.value !== "objLimit") {
                        dbColumnName = _.filter((graphField.type as GraphQLObjectType).getFields(), (field: GraphQLField<any, any>) => field.name === arg.name.value)[0].extensions?.dbColumnName;
                    }
                }

                if (arg.name.value === "objPage" || arg.name.value === "objLimit") {
                    if (this.objPagination.some(x => x.key === graphField.name)) {
                        const foundPageObject = this.objPagination.find(x => x.key === graphField.name);
                        if (foundPageObject) {
                            if (arg.name.value === "objLimit") {
                                foundPageObject.limit = arg.value.value;
                            } else if (arg.name.value === "objPage") {
                                foundPageObject.page = arg.value.value;
                            }
                        }
                    } else if (arg.name.value === "objLimit") {
                        this.objPagination.push({
                            key: graphField.name,
                            tableName: graphField.extensions?.dbTableName,
                            page: 1,
                            limit: arg.value.value,
                        });
                    } else if (arg.name.value === "objPage") {
                        this.objPagination.push({
                            key: graphField.name,
                            tableName: graphField.extensions?.dbTableName,
                            page: arg.value.value,
                            limit: 0,
                        });
                    }
                }

                if (arg.name.value !== "objLimit" && arg.name.value !== "objPage") {
                    subArgs[dbColumnName] = arg.value.value;
                }
            });

            if (!_.isEmpty(subArgs)) {
                this.whereOrderByHandler(graphField.extensions?.dbTableName, `t${this.currentTableIndex}`, subArgs);
            }

            // Recursion
            const subHydration: any = this.turnGraphNodeIntoSql(
                (selection as FieldNode).selectionSet?.selections ?? [],
                subFields,
                subPrimaryKey,
                subArgs,
                subTable);

            // Push in hydration based off of join syntax
            if (graphField.name.toString().startsWith("from_")) {
                returnHydration[graphField.name] = [];
                returnHydration[graphField.name].push(subHydration);
            }

            if (graphField.name.toString().startsWith("to_")) {
                returnHydration[graphField.name] = subHydration;
            }

            // Iterate
            if (this.tables.some((ctable: ConverterDatabaseTable) => ctable.index === this.currentTableIndex)) {
                this.currentTableIndex++;
            }
        });

        // Give back hydration
        return returnHydration;
    }

    public whereOrderByHandler = (tableName: string, tableAlias: string, args: any): void => {

        if (!args || Object.keys(args).length === 0) {
            return;
        }

        const schemaFilePath: string = `${this.fileSystemWorker.getCurrentExecutionDirectory()}/${OmniHiveConstants.SERVER_OUTPUT_DIRECTORY}/connections/${this.databaseWorker.config.name}.json`;
        const jsonSchema: any = JSON.parse(this.fileSystemWorker.readFile(schemaFilePath));

        let tableSchema: TableSchema[] = jsonSchema["tables"];
        tableSchema = tableSchema.filter((tableSchema: TableSchema) => tableSchema.tableName === tableName);

        const validArgs: any = {};

        Object.keys(args).forEach((key: string) => {
            if (key !== "dbPage" && key !== "dbLimit" && key !== "objPage" && key !== "objLimit") {
                validArgs[key] = args[key].toString();
            }
        });

        Object.keys(validArgs).forEach((key: string) => {
            let columnSchema: TableSchema | undefined = tableSchema.find((column: TableSchema) => {
                return column.columnNameDatabase === key;
            });

            if (!columnSchema) {
                columnSchema = tableSchema.find((column: TableSchema) => {
                    return column.columnNameEntity === key;
                });
            }

            if (!columnSchema) {
                return;
            }

            const whereRootSplitter: string[] = validArgs[key].toString().split("||");
            const whereArgs: string[] = whereRootSplitter.filter((splitterString: string) => !splitterString.toLowerCase().includes("orderby")).map(x => x.trim());
            const orderByArgs: string[] = whereRootSplitter.filter((splitterString: string) => splitterString.toLowerCase().includes("orderby")).map(y => y.trim());

            orderByArgs.forEach((orderBy: string) => {
                if (columnSchema) {
                    this.orderByList.push({
                        column: `${tableAlias}.${columnSchema.columnNameDatabase}`,
                        order: orderBy.includes("asc") ? "asc" : "desc",
                    });
                }
            });

            if (this.whereHitCounter === 0) {

                this.query.where((subWhereBuilder) => {
                    whereArgs.forEach((whereSub: string, subIndex: number) => {
                        if (subIndex === 0) {
                            if (!StringHelper.isNullOrWhiteSpace(tableAlias)) {
                                subWhereBuilder.whereRaw(tableAlias + "." + columnSchema?.columnNameDatabase + " " + whereSub);
                            } else {
                                subWhereBuilder.whereRaw(columnSchema?.columnNameDatabase + " " + whereSub);
                            }
                        } else {
                            if (!StringHelper.isNullOrWhiteSpace(tableAlias)) {
                                subWhereBuilder.orWhereRaw(tableAlias + "." + columnSchema?.columnNameDatabase + " " + whereSub);
                            } else {
                                subWhereBuilder.orWhereRaw(columnSchema?.columnNameDatabase + " " + whereSub);
                            }
                        }
                    });
                });
            } else {
                this.query.andWhere((subWhereBuilder) => {
                    whereArgs.forEach((whereSub: string, subIndex: number) => {
                        if (subIndex === 0) {
                            if (!StringHelper.isNullOrWhiteSpace(tableAlias)) {
                                subWhereBuilder.whereRaw(tableAlias + "." + columnSchema?.columnNameDatabase + " " + whereSub);
                            } else {
                                subWhereBuilder.whereRaw(columnSchema?.columnNameDatabase + " " + whereSub);
                            }
                        } else {
                            if (!StringHelper.isNullOrWhiteSpace(tableAlias)) {
                                subWhereBuilder.orWhereRaw(tableAlias + "." + columnSchema?.columnNameDatabase + " " + whereSub);
                            } else {
                                subWhereBuilder.orWhereRaw(columnSchema?.columnNameDatabase + " " + whereSub);
                            }
                        }
                    });
                });
            }

            this.whereHitCounter++;
        });
    }
}