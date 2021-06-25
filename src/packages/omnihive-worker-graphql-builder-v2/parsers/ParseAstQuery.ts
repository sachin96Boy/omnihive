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

    public parse = async (
        workerName: string,
        _args: any,
        resolveInfo: GraphQLResolveInfo,
        omniHiveContext: GraphContext,
        schema: { [tableName: string]: TableSchema[] }
    ): Promise<any> => {
        try {
            this.schema = schema;
            this.setRequiredWorkers(workerName);
            this.verifyToken(omniHiveContext);
            this.buildQuery(resolveInfo);

            if (this.builder) {
                const results: any = [];

                results.push((await this.databaseWorker?.executeQuery(this.builder.toString()))?.[0]);

                if (results) {
                    this.buildGraphReturn(this.queryStructure[this.parentCall], results[0]);
                }

                return this.graphReturn;
            }
        } catch (err) {
            throw err;
        }
    };

    private setRequiredWorkers = (workerName: string) => {
        this.logWorker = global.omnihive.getWorker<ILogWorker | undefined>(HiveWorkerType.Log);

        if (IsHelper.isNullOrUndefined(this.logWorker)) {
            throw new Error("Log Worker Not Defined.  This graph converter will not work without a Log worker.");
        }

        this.databaseWorker = global.omnihive.getWorker<IDatabaseWorker | undefined>(
            HiveWorkerType.Database,
            workerName
        );

        if (IsHelper.isNullOrUndefined(this.databaseWorker)) {
            throw new Error(
                "Database Worker Not Defined.  This graph converter will not work without a Database worker."
            );
        }
        this.knex = this.databaseWorker.connection as Knex;

        this.encryptionWorker = global.omnihive.getWorker<IEncryptionWorker | undefined>(HiveWorkerType.Encryption);

        if (IsHelper.isNullOrUndefined(this.encryptionWorker)) {
            throw new Error(
                "Encryption Worker Not Defined.  This graph converter with Cache worker enabled will not work without an Encryption worker."
            );
        }

        // this.cacheWorker = global.omnihive.getWorker<ICacheWorker | undefined>(HiveWorkerType.Cache);
        // this.dateWorker = global.omnihive.getWorker<IDateWorker | undefined>(HiveWorkerType.Date);
    };

    private verifyToken = async (omniHiveContext: GraphContext): Promise<void> => {
        const tokenWorker: ITokenWorker | undefined = global.omnihive.getWorker<ITokenWorker | undefined>(
            HiveWorkerType.Token
        );

        let disableSecurity: boolean =
            global.omnihive.getEnvironmentVariable<boolean>("OH_SECURITY_DISABLE_TOKEN_CHECK") ?? false;

        if (!disableSecurity && IsHelper.isNullOrUndefined(tokenWorker)) {
            // throw new Error("[ohAccessError] No token worker defined.");
        }

        if (
            !disableSecurity &&
            !IsHelper.isNullOrUndefined(tokenWorker) &&
            (IsHelper.isNullOrUndefined(omniHiveContext) ||
                IsHelper.isNullOrUndefined(omniHiveContext.access) ||
                IsHelper.isEmptyStringOrWhitespace(omniHiveContext.access))
        ) {
            // throw new Error("[ohAccessError] Access token is invalid or expired.");
        }

        if (
            !disableSecurity &&
            !IsHelper.isNullOrUndefined(tokenWorker) &&
            !IsHelper.isNullOrUndefined(omniHiveContext) &&
            !IsHelper.isNullOrUndefined(omniHiveContext.access) &&
            !IsHelper.isEmptyStringOrWhitespace(omniHiveContext.access)
        ) {
            const verifyToken: boolean = await AwaitHelper.execute(tokenWorker.verify(omniHiveContext.access));
            if (!verifyToken) {
                // throw new Error("[ohAccessError] Access token is invalid or expired.");
            }
        }
    };

    private buildQuery = (resolveInfo: GraphQLResolveInfo): void => {
        if (!this.knex) {
            throw new Error("Knex object is not initialized");
        }

        this.builder = this.knex.queryBuilder();
        this.parentCall = resolveInfo.fieldName;

        this.queryStructure = this.getQueryStructure(
            resolveInfo.operation.selectionSet.selections.filter(
                (x) => (x as FieldNode).name.value === this.parentCall
            ) as FieldNode[],
            this.parentCall,
            0,
            this.fieldAliasMap
        );

        Object.keys(this.queryStructure).forEach((key) => {
            if (!this.builder) {
                throw new Error("Knex Query Builder did not initialize correctly");
            }

            const tableSchema: TableSchema[] = this.schema[key];
            this.builder?.from(`${tableSchema[0].tableName} as t1`);

            // Build queries
            this.graphToKnex(this.queryStructure[key], this.parentCall, this.parentCall);
        });
    };

    private getQueryStructure = (
        graphField: readonly FieldNode[],
        parentKey: string,
        tableCount: number,
        aliasKeys: any
    ): any => {
        let structure: any = {};

        graphField.forEach((field) => {
            const fieldSelections = field?.selectionSet?.selections;

            if (fieldSelections && fieldSelections.length > 0) {
                if (!structure[field.name.value]) {
                    structure[field.name.value] = {};
                }

                tableCount++;
                structure[field.name.value] = this.getQueryStructure(
                    fieldSelections as FieldNode[],
                    field.name.value,
                    tableCount,
                    aliasKeys
                );
                structure[field.name.value].tableAlias = `t${tableCount}`;
            } else {
                if (!structure.columns) {
                    structure.columns = [];
                }
                const fieldKeys: any = { name: field.name.value, alias: `f${this.columnCount}` };
                aliasKeys.push(fieldKeys);
                structure.columns.push(fieldKeys);
                this.columnCount++;
            }

            if (field.name.value.endsWith(this.joinFieldSuffix) || field.name.value === this.parentCall) {
                const tableKey = field.name.value.replace(this.joinFieldSuffix, "");

                if (this.schema[tableKey]) {
                    structure[field.name.value].tableKey = tableKey;
                    structure[field.name.value].parentTableKey = parentKey.replace(this.joinFieldSuffix, "");
                } else {
                    structure[field.name.value].tableKey = this.schema[parentKey].find(
                        (x) => field.name.value.replace(this.joinFieldSuffix, "") === x.columnNameEntity
                    )?.columnForeignKeyTableNameCamelCase;
                    structure[field.name.value].linkingTableKey = parentKey;
                }
            }

            const args = this.flattenArgs(field.arguments as unknown as readonly ObjectFieldNode[]);

            if (args && Object.keys(args).length > 0) {
                structure[field.name.value].args = args;
            }
        });

        return structure;
    };

    private flattenArgs = (args: readonly ObjectFieldNode[]): any => {
        const flattened: any = {};

        args.forEach((x) => {
            if ((x.value as ObjectValueNode)?.fields?.length > 0) {
                flattened[x.name.value] = this.flattenArgs((x.value as ObjectValueNode).fields);
            } else if ((x.value as ListValueNode)?.values?.length > 0) {
                flattened[x.name.value] = [];
                (x.value as ListValueNode).values.forEach((y) => {
                    if ((y as ObjectValueNode).fields?.length > 0) {
                        flattened[x.name.value].push(
                            this.flattenArgs((y as ObjectValueNode).fields as readonly ObjectFieldNode[])
                        );
                    } else {
                        flattened[x.name.value].push((y as unknown as ObjectFieldNode).value);
                    }
                });
            } else {
                flattened[x.name.value] = (x.value as unknown as ObjectFieldNode).value;
            }
        });

        return flattened;
    };

    private graphToKnex = (structure: any, parentKey: string, queryKey: string) => {
        if (!this.builder) {
            throw new Error("Knex Query Builder not initialized");
        }

        if (!structure || Object.keys(structure).length <= 0) {
            throw new Error("The Graph Query is not structured properly");
        }

        if (!this.builder) {
            throw new Error("Knex Query Builder did not initialize correctly");
        }

        this.buildSelect(structure.columns, structure.tableAlias, parentKey);
        this.buildJoins(structure, parentKey, queryKey);

        if (
            !structure.args?.join ||
            (structure.args?.join?.whereMode && structure.args?.join?.whereMode === "global")
        ) {
            this.buildConditions(structure.args, structure.tableAlias, this.builder, parentKey);
        }

        Object.keys(structure).forEach((key) => {
            // Build inner queries
            if (key.endsWith(this.joinFieldSuffix)) {
                this.graphToKnex(structure[key], structure[key].tableKey, key);
            }
        });
    };

    private buildJoins = (structure: any, tableKey: string, queryKey: string) => {
        if (!this.builder) {
            throw new Error("Knex Query Builder not initialized");
        }

        if (structure.args?.join) {
            let joinTable: string = this.schema[tableKey]?.[0]?.tableName;
            let primaryColumnName: string = "";
            let linkingColumnName: string = "";
            const schemaKey = structure.linkingTableKey ? structure.linkingTableKey : tableKey;

            const primaryColumn: TableSchema | undefined = this.schema[schemaKey]?.find(
                (x) =>
                    x.columnNameEntity === structure.args.join.from ||
                    (!structure.args.join.from && x.columnNameEntity === queryKey.replace(this.joinFieldSuffix, ""))
            );

            let parentAlias = "";

            if (primaryColumn) {
                primaryColumnName = `${primaryColumn.columnNameDatabase}`;
                linkingColumnName = `${primaryColumn.columnForeignKeyColumnName}`;

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
            }

            const whereSpecific: boolean = structure.args?.join?.whereMode === "specific";

            switch (structure.args.join.type) {
                case "inner": {
                    if (whereSpecific) {
                        this.builder.innerJoin(`${joinTable} as ${structure.tableAlias}`, (builder) => {
                            builder.on(primaryColumnName, "=", linkingColumnName);
                            this.buildConditions(structure.args, structure.tableAlias, builder, tableKey, true);
                        });
                    } else {
                        this.builder.innerJoin(
                            `${joinTable} as ${structure.tableAlias}`,
                            primaryColumnName,
                            linkingColumnName
                        );
                    }
                    break;
                }
                case "left": {
                    if (whereSpecific) {
                        this.builder.leftJoin(`${joinTable} as ${structure.tableAlias}`, (builder) => {
                            builder.on(primaryColumnName, "=", linkingColumnName);
                            this.buildConditions(structure.args, structure.tableAlias, builder, tableKey, true);
                        });
                    } else {
                        this.builder.leftJoin(
                            `${joinTable} as ${structure.tableAlias}`,
                            primaryColumnName,
                            linkingColumnName
                        );
                    }
                    break;
                }
                case "leftOuter": {
                    if (whereSpecific) {
                        this.builder.leftOuterJoin(`${joinTable} as ${structure.tableAlias}`, (builder) => {
                            builder.on(primaryColumnName, "=", linkingColumnName);
                            this.buildConditions(structure.args, structure.tableAlias, builder, tableKey, true);
                        });
                    } else {
                        this.builder.leftOuterJoin(
                            `${joinTable} as ${structure.tableAlias}`,
                            primaryColumnName,
                            linkingColumnName
                        );
                    }
                    break;
                }
                case "right": {
                    if (whereSpecific) {
                        this.builder.rightJoin(`${joinTable} as ${structure.tableAlias}`, (builder) => {
                            builder.on(primaryColumnName, "=", linkingColumnName);
                            this.buildConditions(structure.args, structure.tableAlias, builder, tableKey, true);
                        });
                    } else {
                        this.builder.rightJoin(
                            `${joinTable} as ${structure.tableAlias}`,
                            primaryColumnName,
                            linkingColumnName
                        );
                    }
                    break;
                }
                case "rightOuter": {
                    if (whereSpecific) {
                        this.builder.rightOuterJoin(`${joinTable} as ${structure.tableAlias}`, (builder) => {
                            builder.on(primaryColumnName, "=", linkingColumnName);
                            this.buildConditions(structure.args, structure.tableAlias, builder, tableKey, true);
                        });
                    } else {
                        this.builder.rightOuterJoin(
                            `${joinTable} as ${structure.tableAlias}`,
                            primaryColumnName,
                            linkingColumnName
                        );
                    }
                    break;
                }
                case "fullOuter": {
                    if (whereSpecific) {
                        this.builder.fullOuterJoin(`${joinTable} as ${structure.tableAlias}`, (builder) => {
                            builder.on(primaryColumnName, "=", linkingColumnName);
                            this.buildConditions(structure.args, structure.tableAlias, builder, tableKey, true);
                        });
                    } else {
                        this.builder.fullOuterJoin(
                            `${joinTable} as ${structure.tableAlias}`,
                            primaryColumnName,
                            linkingColumnName
                        );
                    }
                    break;
                }
                case "cross": {
                    if (whereSpecific) {
                        this.builder.crossJoin(`${joinTable} as ${structure.tableAlias}`, (builder) => {
                            builder.on(primaryColumnName, "=", linkingColumnName);
                            this.buildConditions(structure.args, structure.tableAlias, builder, tableKey, true);
                        });
                    } else {
                        this.builder.crossJoin(
                            `${joinTable} as ${structure.tableAlias}`,
                            primaryColumnName,
                            linkingColumnName
                        );
                    }
                    break;
                }
                default: {
                    if (whereSpecific) {
                        this.builder.join(`${joinTable} as ${structure.tableAlias}`, (builder) => {
                            builder.on(primaryColumnName, "=", linkingColumnName);
                            this.buildConditions(structure.args, structure.tableAlias, builder, tableKey, true);
                        });
                    } else {
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
    };

    private findParentAlias = (structure: any, tableKey: string): string => {
        if (structure.tableKey === tableKey) {
            return structure.tableAlias;
        } else {
            for (const key in structure) {
                let alias: string = "";
                if (key.endsWith(this.joinFieldSuffix)) {
                    alias = this.findParentAlias(structure[key], tableKey);
                }

                if (alias) {
                    return alias;
                }
            }

            return "";
        }
    };

    private buildSelect = (columns: { name: string; alias: string }[], tableAlias: string, tableName: string): void => {
        if (columns) {
            columns.forEach((field) => {
                const column = this.schema[tableName].find((column) => column.columnNameEntity === field.name);

                if (column && !this.selectionFields.some((x) => x.columnNameEntity === column.columnNameEntity)) {
                    this.selectionFields.push(column);

                    this.builder?.distinct(`${tableAlias}.${column.columnNameDatabase} as ${field.alias}`);
                }
            });
        }
    };

    private buildConditions = (
        args: any,
        tableAlias: string,
        builder: Knex.QueryBuilder<any, unknown[]> | Knex.JoinClause,
        tableName: string,
        join: boolean = false
    ) => {
        for (const knexFunction in args) {
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

    private buildEqualities = (
        arg: any,
        tableAlias: string,
        builder: Knex.QueryBuilder<any, unknown[]> | Knex.JoinClause,
        tableName: string,
        having: boolean = false,
        join: boolean = false
    ): void => {
        if (!builder) {
            throw new Error("Knex Query Builder is not initialized");
        }

        for (const key in arg) {
            if (key === "and") {
                if (join) {
                    (builder as Knex.JoinClause).orOn((subBuilder) => {
                        for (const innerArg of arg.and) {
                            this.buildEqualities(innerArg, tableAlias, subBuilder, tableName, false, join);
                        }
                    });
                }
                (builder as Knex.QueryBuilder)[having ? "andHaving" : "andWhere"]((subBuilder) => {
                    for (const innerArg of arg.and) {
                        this.buildEqualities(innerArg, tableAlias, subBuilder, tableName, having);
                    }
                });
                continue;
            }

            if (key === "or") {
                if (join) {
                    (builder as Knex.JoinClause).orOn((subBuilder) => {
                        for (const innerArg of arg.or) {
                            this.buildEqualities(innerArg, tableAlias, subBuilder, tableName, false, join);
                        }
                    });
                }
                (builder as Knex.QueryBuilder)[having ? "orHaving" : "orWhere"]((subBuilder) => {
                    for (const innerArg of arg.or) {
                        this.buildEqualities(innerArg, tableAlias, subBuilder, tableName, having);
                    }
                });

                continue;
            }

            const columnName = this.schema[tableName].find((c) => c.columnNameEntity === key)?.columnNameDatabase;

            if (columnName) {
                this.buildRowEquality(`${tableAlias}.${columnName}`, arg[key], builder, having, join);
            }
        }
    };

    private buildRowEquality = (
        argName: string,
        arg: any,
        builder: Knex.QueryBuilder<any, unknown[]> | Knex.JoinClause,
        having: boolean = false,
        join: boolean = false
    ): void => {
        if (!this.knex) {
            throw new Error("Knex is not initialized");
        }

        for (const equality in arg) {
            let argValue = arg[equality];

            if (argValue.subquery) {
                argValue = this.knex.raw(`${argValue.subquery}`);
            }

            if (join) {
                if (typeof argValue === "string") {
                    argValue = this.knex.raw(`'${argValue}'`);
                } else {
                    argValue = this.knex.raw(argValue);
                }
            }

            if (typeof argValue === "boolean") {
                argValue = argValue ? 1 : 0;
            }

            switch (equality) {
                case "eq": {
                    if (join) {
                        (builder as Knex.JoinClause).on(argName, "=", argValue);
                    } else if (having) {
                        (builder as Knex.QueryBuilder).having(argName, "=", argValue);
                    } else {
                        (builder as Knex.QueryBuilder).where(argName, argValue);
                    }
                    break;
                }
                case "notEq": {
                    if (join) {
                        (builder as Knex.JoinClause).on(argName, "!=", argValue);
                    } else if (having) {
                        (builder as Knex.QueryBuilder).having(argName, "!=", argValue);
                    } else {
                        (builder as Knex.QueryBuilder).whereNot(argName, argValue);
                    }
                    break;
                }
                case "like": {
                    if (join) {
                        (builder as Knex.JoinClause).on(argName, "like", argValue);
                    } else {
                        (builder as Knex.QueryBuilder)[having ? "having" : "where"](argName, "like", argValue);
                    }
                    break;
                }
                case "notLike": {
                    if (join) {
                        (builder as Knex.JoinClause).on(argName, "not like", argValue);
                    } else if (having) {
                        (builder as Knex.QueryBuilder).having(argName, "not like", argValue);
                    } else {
                        (builder as Knex.QueryBuilder).whereNot(argName, "like", argValue);
                    }
                    break;
                }
                case "gt": {
                    if (join) {
                        (builder as Knex.JoinClause).on(argName, ">", argValue);
                    } else {
                        (builder as Knex.QueryBuilder)[having ? "having" : "where"](argName, ">", argValue);
                    }
                    break;
                }
                case "gte": {
                    if (join) {
                        (builder as Knex.JoinClause).on(argName, ">=", argValue);
                    } else {
                        (builder as Knex.QueryBuilder)[having ? "having" : "where"](argName, ">=", argValue);
                    }
                    break;
                }
                case "notGt": {
                    if (join) {
                        (builder as Knex.JoinClause).on(argName, "<=", argValue);
                    } else if (having) {
                        (builder as Knex.QueryBuilder).having(argName, "<=", argValue);
                    } else {
                        (builder as Knex.QueryBuilder).whereNot(argName, ">", argValue);
                    }
                    break;
                }
                case "notGte": {
                    if (join) {
                        (builder as Knex.JoinClause).on(argName, "<", argValue);
                    } else if (having) {
                        (builder as Knex.QueryBuilder).having(argName, "<", argValue);
                    } else {
                        (builder as Knex.QueryBuilder).whereNot(argName, ">=", argValue);
                    }
                    break;
                }
                case "lt": {
                    if (join) {
                        (builder as Knex.JoinClause).on(argName, "<", argValue);
                    } else {
                        (builder as Knex.QueryBuilder)[having ? "having" : "where"](argName, "<", argValue);
                    }
                    break;
                }
                case "lte": {
                    if (join) {
                        (builder as Knex.JoinClause).on(argName, "<=", argValue);
                    } else {
                        (builder as Knex.QueryBuilder)[having ? "having" : "where"](argName, "<=", argValue);
                    }
                    break;
                }
                case "notLt": {
                    if (join) {
                        (builder as Knex.JoinClause).on(argName, ">=", argValue);
                    } else if (having) {
                        (builder as Knex.QueryBuilder).having(argName, ">=", argValue);
                    } else {
                        (builder as Knex.QueryBuilder).whereNot(argName, "<", argValue);
                    }
                    break;
                }
                case "notLte": {
                    if (join) {
                        (builder as Knex.JoinClause).on(argName, ">", argValue);
                    } else if (having) {
                        (builder as Knex.QueryBuilder).having(argName, ">", argValue);
                    } else {
                        (builder as Knex.QueryBuilder).whereNot(argName, "<=", argValue);
                    }
                    break;
                }
                case "in": {
                    if (join) {
                        (builder as Knex.JoinClause).onIn(argName, argValue);
                    } else {
                        (builder as Knex.QueryBuilder)[having ? "havingIn" : "whereIn"](argName, argValue);
                    }
                    break;
                }
                case "notIn": {
                    if (join) {
                        (builder as Knex.JoinClause).onNotIn(argName, argValue);
                    } else {
                        (builder as Knex.QueryBuilder)[having ? "havingNotIn" : "whereNotIn"](argName, argValue);
                    }
                    break;
                }
                case "isNull": {
                    if (join) {
                        (builder as Knex.JoinClause).onNull(argName);
                    } else if (having) {
                        (builder as Knex.QueryBuilder).having(argName, "is", this.knex.raw("null"));
                    } else {
                        (builder as Knex.QueryBuilder).whereNull(argName);
                    }
                    break;
                }
                case "isNotNull": {
                    if (join) {
                        (builder as Knex.JoinClause).onNotNull(argName);
                    } else if (having) {
                        (builder as Knex.QueryBuilder).having(argName, "is not", this.knex.raw("null"));
                    } else {
                        (builder as Knex.QueryBuilder).whereNotNull(argName);
                    }
                    break;
                }
                case "exists": {
                    if (join) {
                        (builder as Knex.JoinClause).onExists(argValue);
                    } else if (having) {
                        throw new Error("The Having function does not support the exists equality");
                    } else {
                        (builder as Knex.QueryBuilder).whereExists(argValue);
                    }
                    break;
                }
                case "notExists": {
                    if (join) {
                        (builder as Knex.JoinClause).onNotExists(argValue);
                    } else if (having) {
                        throw new Error("The Having function does not support the notExists equality");
                    } else {
                        (builder as Knex.QueryBuilder).whereNotExists(argValue);
                    }
                    break;
                }
                case "between": {
                    if (join) {
                        (builder as Knex.JoinClause).onBetween(argName, [argValue.start, argValue.end]);
                    } else {
                        (builder as Knex.QueryBuilder)[having ? "havingBetween" : "whereBetween"](argName, [
                            argValue.start,
                            argValue.end,
                        ]);
                    }
                    break;
                }
                case "notBetween": {
                    if (join) {
                        (builder as Knex.JoinClause).onNotBetween(argName, [argValue.start, argValue.end]);
                    } else {
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

    private buildOrderBy = (arg: any, tableAlias: string, tableName: string): void => {
        const orderByArgs: { column: string; order: "asc" | "desc" }[] = [];

        for (const field of arg) {
            Object.keys(field).map((key) => {
                const dbName = this.schema[tableName].find(
                    (column) => column.columnNameEntity === key
                )?.columnNameDatabase;

                if (dbName) {
                    orderByArgs.push({ column: `${tableAlias}.${dbName}`, order: field[key] });
                }
            });
        }

        this.builder?.orderBy(orderByArgs);
    };

    private buildGroupBy = (arg: { columns: string[]; having: any }, tableAlias: string, tableName: string): void => {
        if (!this.builder) {
            throw new Error("Knex Query Builder is not initialized");
        }

        const dbNames: string[] = [];

        const findDbName = (fieldName: string) => {
            const name = this.schema[tableName].find(
                (column) => column.columnNameEntity === fieldName
            )?.columnNameDatabase;

            if (name) {
                dbNames.push(`${tableAlias}.${name}`);
            }
        };

        if (Array.isArray(arg.columns)) {
            arg.columns.forEach((x) => findDbName(x));
        } else {
            findDbName(arg.columns);
        }

        this.builder.groupBy(dbNames);

        this.buildEqualities(arg.having, tableAlias, this.builder, tableName, true);
    };

    private buildGraphReturn = (structure: any, results: any): any => {
        const condensedResults: any = [];
        results.forEach((dbItem: any) => {
            this.processRow(condensedResults, dbItem, structure);
        });

        this.graphReturn = condensedResults;
    };

    private processRow = (results: any, dbItem: any, structure: any) => {
        let parent: any;

        const columns: { name: string; alias: string }[] = structure.columns ?? [];
        const linkingKeys: string[] = Object.keys(structure).filter((x: string) => x.endsWith(this.joinFieldSuffix));

        if (results.length <= 0) {
            results.push({});
        }

        for (const item of results) {
            if (this.compareParentData(columns, item, dbItem)) {
                parent = item;
            }
        }

        if (parent) {
            this.buildDataFromRow(parent, dbItem, columns, linkingKeys, structure);
        } else {
            if (Object.keys(results[results.length - 1]).length > 0) {
                results.push({});
            }

            this.buildDataFromRow(results[results.length - 1], dbItem, columns, linkingKeys, structure);
        }
    };

    private buildDataFromRow = (
        item: any,
        dbItem: any,
        columns: { name: string; alias: string }[],
        linkingKeys: string[],
        structure: any
    ) => {
        for (const col of columns) {
            if (!item[col.name]) {
                item[col.name] = dbItem[col.alias];
            }
        }

        for (const key of linkingKeys) {
            if (!item[key]) {
                item[key] = [];
            }

            this.processRow(item[key], dbItem, structure[key]);
        }
    };

    private compareParentData = (columns: { name: string; alias: string }[], item: any, dbItem: any) => {
        let match: boolean = true;
        for (const col of columns) {
            if (!item[col.name]) {
                match = false;
            } else if (item[col.name] === dbItem[col.alias]) {
                continue;
            } else {
                match = false;
            }
        }

        return match;
    };

    private compareObject = (obj1: any, obj2: any) => {
        if (obj1 === obj2) {
            return true;
        }

        if (!obj1 || !obj2) {
            return false;
        }

        const obj1Keys: string[] = Object.keys(obj1);
        const obj2Keys: string[] = Object.keys(obj2);

        if (obj1Keys.length !== obj2Keys.length) {
            return false;
        }

        for (const key of obj1Keys) {
            if (!obj2Keys.some((x) => this.compareObject(x, key))) {
                return false;
            }
            if (!this.compareObject(obj1[key], obj2[key])) {
                return false;
            }
        }

        return true;
    };
}
