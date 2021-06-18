/// <reference path="../../../types/globals.omnihive.d.ts" />

import { ArgumentNode, FieldNode, GraphQLResolveInfo, ObjectFieldNode, ObjectValueNode } from "graphql";
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
    private builder: Knex.QueryBuilder<any, unknown[]> | undefined;
    private selectionFields: TableSchema[] = [];

    private joinFieldSuffix: string = "_table";

    public parse = async (
        workerName: string,
        _args: any,
        resolveInfo: GraphQLResolveInfo,
        omniHiveContext: GraphContext,
        schema: { [tableName: string]: TableSchema[] }
    ): Promise<any> => {
        try {
            this.setRequiredWorkers(workerName);
            this.verifyToken(omniHiveContext);
            this.buildQuery(resolveInfo, schema);

            if (this.builder) {
                const results = (await this.databaseWorker?.executeQuery(this.builder.toString()))?.[0];

                if (results) {
                    return this.convertToGraph(results);
                }

                return null;
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

    private buildQuery = (resolveInfo: GraphQLResolveInfo, schema: { [tableName: string]: TableSchema[] }): void => {
        if (!this.knex) {
            throw new Error("Knex object is not initialized");
        }

        const primaryTable = schema[resolveInfo.fieldName][0].tableName;
        const primarySchemaProp = resolveInfo.fieldName;

        this.builder = this.knex.queryBuilder();
        this.builder.from(primaryTable);

        resolveInfo.operation.selectionSet.selections.forEach((field: any) =>
            this.graphToKnex(field.arguments, field, schema, primarySchemaProp)
        );
    };

    private graphToKnex = (
        args: readonly ArgumentNode[],
        field: FieldNode,
        schema: { [tableName: string]: TableSchema[] },
        tableName: string
    ) => {
        if (!this.builder) {
            throw new Error("Knex Query Builder not initialized");
        }
        // TODO: Iterate through each selectionSet to build the query. if (field.name.value.endsWith(this.joinFieldSuffix) === Repeat logic for new table)

        const flattenedArgs = this.flattenArgs(args as unknown as readonly ObjectFieldNode[]);

        this.buildSelect(field, schema, tableName, false);

        for (const knexFunction in flattenedArgs) {
            switch (knexFunction) {
                case "where": {
                    this.buildEqualities(flattenedArgs[knexFunction], this.builder, schema, tableName);
                    break;
                }
                case "orderBy": {
                    this.buildOrderBy(flattenedArgs[knexFunction], schema, tableName);
                    break;
                }
                case "groupBy": {
                    this.buildGroupBy(flattenedArgs[knexFunction], schema, tableName);
                    break;
                }
            }
        }
    };

    private flattenArgs = (args: readonly ObjectFieldNode[]): any => {
        const flattened: any = {};

        args.forEach((x) => {
            if ((x.value as ObjectValueNode).fields?.length > 0) {
                flattened[x.name.value] = this.flattenArgs((x.value as ObjectValueNode).fields);
            } else {
                flattened[x.name.value] = (x.value as unknown as ObjectFieldNode).value;
            }
        });

        return flattened;
    };

    private buildSelect = (
        field: FieldNode,
        schema: { [tableName: string]: TableSchema[] },
        tableName: string,
        distinct: boolean
    ): void => {
        const fields = field.selectionSet?.selections.map((field) => (field as FieldNode).name.value);

        if (fields) {
            fields.forEach((field) => {
                if (field.endsWith(this.joinFieldSuffix)) {
                    return;
                }

                const column = schema[tableName].find((column) => column.columnNameEntity === field);

                if (column) {
                    this.selectionFields.push(column);
                }
            });

            const dbNames = this.selectionFields?.map((x) => x.columnNameDatabase);

            if (dbNames) {
                this.builder?.[distinct ? "distinct" : "select"](dbNames);
            }
        }
    };

    private buildEqualities = (
        arg: any,
        builder: Knex.QueryBuilder<any, unknown[]>,
        schema: { [tableName: string]: TableSchema[] },
        tableName: string,
        having: boolean = false
    ): void => {
        if (!builder) {
            throw new Error("Knex Query Builder is not initialized");
        }

        for (const key in arg) {
            if (key === "and") {
                builder[having ? "andHaving" : "andWhere"]((subBuilder) => {
                    for (const innerArg of arg.and) {
                        this.buildEqualities(innerArg, subBuilder, schema, tableName, having);
                    }
                });
                continue;
            }

            if (key === "or") {
                builder[having ? "orHaving" : "orWhere"]((subBuilder) => {
                    for (const innerArg of arg.or) {
                        this.buildEqualities(innerArg, subBuilder, schema, tableName, having);
                    }
                });

                continue;
            }

            const columnName = schema[tableName].find((c) => c.columnNameEntity === key)?.columnNameDatabase;

            if (columnName) {
                this.buildRowEquality(columnName, arg[key], builder, having);
            }
        }
    };

    private buildRowEquality = (
        argName: string,
        arg: any,
        builder: Knex.QueryBuilder<any, unknown[]>,
        having: boolean = false
    ): void => {
        if (!this.knex) {
            throw new Error("Knex is not initialized");
        }

        for (const equality in arg) {
            let argValue = arg[equality];

            if (argValue.subquery) {
                argValue = this.knex.raw(`${argValue.subquery}`);
            }

            if (typeof argValue === "boolean") {
                argValue = argValue ? 1 : 0;
            }

            switch (equality) {
                case "eq": {
                    if (having) {
                        builder.having(argName, "=", argValue);
                    } else {
                        builder.where(argName, argValue);
                    }
                    break;
                }
                case "notEq": {
                    if (having) {
                        builder.having(argName, "!=", argValue);
                    } else {
                        builder.whereNot(argName, argValue);
                    }
                    break;
                }
                case "like": {
                    builder[having ? "having" : "where"](argName, "like", argValue);
                    break;
                }
                case "notLike": {
                    if (having) {
                        builder.having(argName, "not like", argValue);
                    } else {
                        builder.whereNot(argName, "like", argValue);
                    }
                    break;
                }
                case "gt": {
                    builder[having ? "having" : "where"](argName, ">", argValue);
                    break;
                }
                case "gte": {
                    builder[having ? "having" : "where"](argName, ">=", argValue);
                    break;
                }
                case "notGt": {
                    if (having) {
                        builder.having(argName, "<=", argValue);
                    } else {
                        builder.whereNot(argName, ">", argValue);
                    }
                    break;
                }
                case "notGte": {
                    if (having) {
                        builder.having(argName, "<", argValue);
                    } else {
                        builder.whereNot(argName, ">=", argValue);
                    }
                    break;
                }
                case "lt": {
                    builder[having ? "having" : "where"](argName, "<", argValue);
                    break;
                }
                case "lte": {
                    builder[having ? "having" : "where"](argName, "<=", argValue);
                    break;
                }
                case "notLt": {
                    if (having) {
                        builder.having(argName, ">=", argValue);
                    } else {
                        builder.whereNot(argName, "<", argValue);
                    }
                    break;
                }
                case "notLte": {
                    if (having) {
                        builder.having(argName, ">", argValue);
                    } else {
                        builder.whereNot(argName, "<=", argValue);
                    }
                    break;
                }
                case "in": {
                    builder[having ? "havingIn" : "whereIn"](argName, argValue);
                    break;
                }
                case "notIn": {
                    builder[having ? "havingNotIn" : "whereNotIn"](argName, argValue);
                    break;
                }
                case "isNull": {
                    if (having) {
                        builder.having(argName, "is", this.knex.raw("null"));
                    } else {
                        builder.whereNull(argName);
                    }
                    break;
                }
                case "isNotNull": {
                    if (having) {
                        builder.having(argName, "is not", this.knex.raw("null"));
                    } else {
                        builder.whereNotNull(argName);
                    }
                    break;
                }
                case "exists": {
                    if (having) {
                        throw new Error("The Having function does not support the exists equality");
                    } else {
                        builder.whereExists(argValue);
                    }
                    break;
                }
                case "notExists": {
                    if (having) {
                        throw new Error("The Having function does not support the notExists equality");
                    } else {
                        builder.whereNotExists(argValue);
                    }
                    break;
                }
                case "between": {
                    builder[having ? "havingBetween" : "whereBetween"](argName, [argValue.start, argValue.end]);
                    break;
                }
                case "notBetween": {
                    builder[having ? "havingNotBetween" : "whereNotBetween"](argName, [argValue.start, argValue.end]);
                    break;
                }
            }
        }
    };

    private buildOrderBy = (arg: any, schema: { [tableName: string]: TableSchema[] }, tableName: string): void => {
        const orderByArgs: { column: string; order: "asc" | "desc" }[] = [];

        for (const field of arg) {
            Object.keys(field).map((key) => {
                const dbName = schema[tableName].find((column) => column.columnNameEntity === key)?.columnNameDatabase;

                if (dbName) {
                    orderByArgs.push({ column: dbName, order: field[key] });
                }
            });
        }

        this.builder?.orderBy(orderByArgs);
    };

    private buildGroupBy = (
        arg: { columns: string[]; having: any },
        schema: { [tableName: string]: TableSchema[] },
        tableName: string
    ): void => {
        if (!this.builder) {
            throw new Error("Knex Query Builder is not initialized");
        }

        const dbNames: string[] = [];
        arg.columns.forEach((x) => {
            const name = schema[tableName].find((column) => column.columnNameEntity === x)?.columnNameDatabase;

            if (name) {
                dbNames.push(name);
            }
        });

        this.builder.groupBy(dbNames);

        this.buildEqualities(arg.having, this.builder, schema, tableName, true);
    };

    private convertToGraph = (results: any): any => {
        const graphResult: any = [];

        results.map((r: any) => {
            const dbNames: string[] = Object.keys(r);
            const row: any = {};

            dbNames.forEach((column) => {
                const entityName: string | undefined = this.selectionFields?.find(
                    (x) => x.columnNameDatabase === column
                )?.columnNameEntity;

                if (entityName) {
                    row[entityName] = r[column];
                }
            });

            graphResult.push(row);
        });

        return graphResult;
    };
}
