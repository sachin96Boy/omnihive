import { HiveWorkerBase } from "@withonevision/omnihive-core/models/HiveWorkerBase";
import { IGraphBuildWorker } from "@withonevision/omnihive-core/interfaces/IGraphBuildWorker";
import { IDatabaseWorker } from "@withonevision/omnihive-core/interfaces/IDatabaseWorker";
import { ConnectionSchema } from "@withonevision/omnihive-core/models/ConnectionSchema";
import { TableSchema } from "@withonevision/omnihive-core/models/TableSchema";
import { GraphHelper } from "./helpers/GraphHelper";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { GraphQLSchema } from "graphql";
import GraphQLAny from "./scalarTypes/GraphQLAny";
import { ParseMaster } from "./parsers/ParseMaster";
import { mergeSchemas } from "@graphql-tools/merge";

export default class GraphBuilder extends HiveWorkerBase implements IGraphBuildWorker {
    // Declare Helpers
    private graphHelper: GraphHelper = new GraphHelper();
    private parseMaster: ParseMaster = new ParseMaster();

    // Declare Static Strings
    private objectSuffix: string = "Type";
    private whereSuffix: string = "WhereType";
    private orderBySuffix: string = "OrderType";
    private columnEnumSuffix: string = "ColumnEnum";
    private groupBySuffix: string = "GroupByType";
    private columnEqualitySuffix: string = "ColumnEqualityType";
    private joiningSuffix: string = "LinkingEnum";
    private joinFieldSuffix: string = "_table";

    // Declare Global Variables
    private graphSchemas: GraphQLSchema[] = [];
    private tables: { [tableName: string]: TableSchema[] } = {};

    public buildDatabaseWorkerSchema = (
        databaseWorker: IDatabaseWorker,
        connectionSchema: ConnectionSchema | undefined
    ): GraphQLSchema | undefined => {
        if (!connectionSchema) {
            return;
        }

        for (const column of connectionSchema.tables) {
            if (!this.tables[column.tableNameCamelCase] || this.tables[column.tableNameCamelCase]?.length <= 0) {
                this.tables[column.tableNameCamelCase] = [];
            }

            if (!this.tables[column.tableNameCamelCase].some((t) => t.columnNameEntity == column.columnNameEntity)) {
                this.tables[column.tableNameCamelCase].push(column);
            }
        }

        for (const tableName in this.tables) {
            this.graphSchemas.push(this.buildExeSchema(this.tables[tableName], databaseWorker));
        }

        return mergeSchemas({
            schemas: this.graphSchemas,
        });
    };

    private buildExeSchema = (schema: TableSchema[], databaseWorker: IDatabaseWorker): GraphQLSchema => {
        const foreignColumns = this.findForeignKeys(schema);

        const typeDef = this.buildTypeDefinitions(schema, foreignColumns);
        const resolver = this.buildResolvers(schema, foreignColumns, databaseWorker);

        return makeExecutableSchema({
            typeDefs: typeDef,
            resolvers: resolver,
        });
    };

    private buildTypeDefinitions = (
        schema: TableSchema[],
        foreignColumns: { [tableName: string]: TableSchema[] }
    ): string => {
        return `
            ${this.buildStaticTypes()}
            ${this.buildLinkingEnum(schema[0].tableNameCamelCase, foreignColumns)}
            ${this.buildColumnEqualityType(schema, foreignColumns)}
            ${this.buildTableDef(schema, foreignColumns)}
            ${this.buildWhereType(schema, foreignColumns)}
            ${this.buildOrderByType(schema, foreignColumns)}
            ${this.buildColumnEnum(schema, foreignColumns)}
            ${this.buildGroupByType(schema, foreignColumns)}
            ${this.buildQueryDef(schema)}
        `;
    };

    private findForeignKeys = (schema: TableSchema[]): { [tableName: string]: TableSchema[] } => {
        const foreignColumns: { [tableName: string]: TableSchema[] } = {};

        schema.forEach((column) => {
            const foreignLink: TableSchema[] = [];

            Object.keys(this.tables).forEach((tableName) => {
                const match = this.tables[tableName].filter(
                    (x) =>
                        x.columnForeignKeyTableNameCamelCase === column.tableNameCamelCase &&
                        x.schemaName === column.schemaName &&
                        x.columnForeignKeyColumnName === column.columnNameDatabase
                );

                match.forEach((item) => foreignLink.push(item));
            });

            foreignLink?.forEach((key) => {
                if (key) {
                    if (!foreignColumns[key.tableNameCamelCase]) {
                        foreignColumns[key.tableNameCamelCase] = [];
                    }

                    if (
                        !foreignColumns[key.tableNameCamelCase].some((x) => key.columnNameEntity === x.columnNameEntity)
                    )
                        foreignColumns[key.tableNameCamelCase].push(key);
                }
            });

            const linkToColumn: TableSchema[] = this.tables[column.columnForeignKeyTableNameCamelCase]?.filter(
                (x) => x.columnNameDatabase === column.columnForeignKeyColumnName
            );

            linkToColumn?.forEach((key) => {
                if (key) {
                    if (!foreignColumns[key.tableNameCamelCase]) {
                        foreignColumns[key.tableNameCamelCase] = [];
                    }

                    if (
                        !foreignColumns[key.tableNameCamelCase].some((x) => key.columnNameEntity === x.columnNameEntity)
                    ) {
                        foreignColumns[key.tableNameCamelCase].push(key);
                    }
                }
            });
        });

        return foreignColumns;
    };

    private buildStaticTypes = (): string =>
        `
            scalar Any

            enum OrderByOptions {
                asc
                desc
            }
            
            input BetweenObject {
                start: Any
                end: Any
            }

            enum JoinOptions {
                inner
                left
                leftOuter
                right
                rightOuter
                fullOuter
                cross
            }

            input EqualityTypes {
                eq: Any
                notEq: Any
                like: Any
                notLike: Any
                gt: Any
                gte: Any
                notGt: Any
                notGte: Any
                lt: Any
                lte: Any
                notLt: Any
                notLte: Any
                in: Any
                notIn: Any
                isNull: Boolean
                isNotNull: Boolean
                exists: Any
                notExists: Any
                between: BetweenObject
                notBetween: BetweenObject
            }
        `.trim();

    private buildLinkingEnum = (
        parentTable: string,
        foreignColumns: { [tableName: string]: TableSchema[] }
    ): string => {
        let results: string = "";

        for (const tableName in foreignColumns) {
            if (parentTable !== foreignColumns[tableName][0].tableNameCamelCase) {
                results += `
                    type ${this.uppercaseFirstLetter(tableName)}${this.objectSuffix} {
                    ${foreignColumns[tableName].map((column) =>
                        `${column.columnNameEntity}: ${this.graphHelper.getGraphTypeFromEntityType(
                            column.columnTypeEntity
                        )}`.trim()
                    )}
                    }
                `.trim();

                results += "\n";
            }

            const foreignLinks = foreignColumns[tableName].filter((x) => x.columnIsForeignKey);

            if (foreignLinks?.length > 0) {
                results += `
                    enum ${this.uppercaseFirstLetter(parentTable)}${this.uppercaseFirstLetter(tableName)}${
                    this.joiningSuffix
                } {
                        ${foreignLinks.map((column) => column.columnNameEntity).join("\n")}
                    }
                `.trim();
            }
        }

        return results;
    };

    private buildColumnEqualityType = (
        schema: TableSchema[],
        foreignColumns: { [tableName: string]: TableSchema[] }
    ): string => {
        const tableName = schema[0].tableNamePascalCase;

        return `
            input ${tableName}${this.columnEqualitySuffix} {
                ${schema.map((column) => `${column.columnNameEntity}: EqualityTypes`.trim())}
            }
        
            ${Object.keys(foreignColumns)
                .map((table) => {
                    if (table === schema[0].tableNameCamelCase) {
                        return;
                    }

                    return `
                        input ${this.uppercaseFirstLetter(table)}${this.columnEqualitySuffix} {
                            ${foreignColumns[table].map((column) => `${column.columnNameEntity}: EqualityTypes`)}
                        }
                    `.trim();
                })
                .join("\n")}
        `.trim();
    };

    private buildTableDef = (schema: TableSchema[], foreignColumns: { [tableName: string]: TableSchema[] }): string => {
        const tableName: string = schema[0].tableNamePascalCase;

        return `
            type ${tableName}${this.objectSuffix} {
                ${schema.map((column) => {
                    let columnDef: string = "";
                    let columnType: string = this.graphHelper.getGraphTypeFromEntityType(column.columnTypeEntity);
                    let columnDefault: string = `${column.columnNameEntity}: ${columnType}`;

                    if (column.columnIsForeignKey) {
                        if (column.columnForeignKeyTableNameCamelCase === column.tableNameCamelCase) {
                            columnDef = `${columnDefault} ${column.columnNameEntity}${
                                this.joinFieldSuffix
                            }(joinType: JoinOptions, ${this.buildArgString(schema)})`;
                        } else {
                            columnDef = `${columnDefault} ${column.columnNameEntity}${
                                this.joinFieldSuffix
                            }(joinType: JoinOptions, ${this.buildArgString(
                                foreignColumns[column.columnForeignKeyTableNameCamelCase]
                            )})`;
                        }

                        columnType = `: [${column.columnForeignKeyTableNamePascalCase}${this.objectSuffix}]`;
                        columnDef += columnType;
                    } else {
                        columnDef = columnDefault;
                    }

                    return `${columnDef}`.trim();
                })}

                ${Object.keys(foreignColumns).map((table) => {
                    const linkingSchema = schema.find((x) =>
                        foreignColumns[table].find((y) => x.columnNameDatabase === y.columnForeignKeyColumnName)
                    );
                    let results = ``;

                    if (
                        !linkingSchema?.columnIsForeignKey &&
                        linkingSchema?.columnForeignKeyTableNameCamelCase !== linkingSchema?.tableNameCamelCase
                    ) {
                        results += `
                            ${table}${this.joinFieldSuffix}(
                                joinType: JoinOptions 
                                fromColumn: ${tableName}${this.uppercaseFirstLetter(table)}${
                            this.joiningSuffix
                        } ${this.buildArgString(this.tables[table])}): [${this.uppercaseFirstLetter(table)}${
                            this.objectSuffix
                        }]`.trim();
                    }

                    return results;
                })}
            }
        `;
    };

    private buildQueryDef = (schema: TableSchema[]): string => {
        const tableName = schema[0].tableNameCamelCase;
        const typeName = schema[0].tableNamePascalCase + this.objectSuffix;

        return `
            type Query {
                ${tableName}(${this.buildArgString(schema)}): [${typeName}]
            }
        `.trim();
    };

    private buildArgString = (schema: TableSchema[]): string => {
        const tableName = schema[0].tableNamePascalCase;

        return `
            distinct: Boolean
            where: ${tableName}${this.whereSuffix}
            orderBy: [${tableName}${this.orderBySuffix}]
            groupBy: ${tableName}${this.groupBySuffix}
        `.trim();
    };

    private buildWhereType = (
        schema: TableSchema[],
        foreignColumns: { [tableName: string]: TableSchema[] }
    ): string => {
        const tableName: string = schema[0].tableNamePascalCase;

        return `
            input ${tableName}${this.whereSuffix}
            ${this.buildColumnEqualities(schema)}

            ${Object.keys(foreignColumns)
                .map((table) => {
                    if (table === schema[0].tableNameCamelCase) {
                        return;
                    }
                    return `
                        input ${this.uppercaseFirstLetter(table)}${this.whereSuffix}
                        ${this.buildColumnEqualities(foreignColumns[table])}
                    `.trim();
                })
                .join("\n")}
        `.trim();
    };

    private buildOrderByType = (
        schema: TableSchema[],
        foreignColumns: { [tableName: string]: TableSchema[] }
    ): string => {
        const tableName = schema[0].tableNamePascalCase;

        return `
            input ${tableName}${this.orderBySuffix} {
                ${schema.map((column) =>
                    `
                    ${column.columnNameEntity}: OrderByOptions
                `.trim()
                )}
            }

            ${Object.keys(foreignColumns)
                .map((table) => {
                    if (table === schema[0].tableNameCamelCase) {
                        return;
                    }
                    return `
                        input ${this.uppercaseFirstLetter(table)}${this.orderBySuffix} {
                            ${foreignColumns[table]
                                .map((column) =>
                                    `
                                        ${column.columnNameEntity}: OrderByOptions
                                    `.trim()
                                )
                                .join("\n")}
                        }
                    `.trim();
                })
                .join("\n")}
        `.trim();
    };

    private buildColumnEnum = (
        schema: TableSchema[],
        foreignColumns: { [tableName: string]: TableSchema[] }
    ): string => {
        const tableName = schema[0].tableNamePascalCase;

        return `
            enum ${tableName}${this.columnEnumSuffix} {
                ${schema.map((column) =>
                    `
                        ${column.columnNameEntity}
                    `.trim()
                )}
            }

            ${Object.keys(foreignColumns)
                .map((table) => {
                    if (table === schema[0].tableNameCamelCase) {
                        return;
                    }

                    return `
                        enum ${this.uppercaseFirstLetter(table)}${this.columnEnumSuffix} {
                            ${foreignColumns[table].map((column) =>
                                `
                                ${column.columnNameEntity}
                            `.trim()
                            )}
                        }
                    `.trim();
                })
                .join("\n")}
        `.trim();
    };

    private buildGroupByType = (
        schema: TableSchema[],
        foreignColumns: { [tableName: string]: TableSchema[] }
    ): string => {
        const tableName = schema[0].tableNamePascalCase;

        return `
            input ${tableName}${this.groupBySuffix} {
                columns: [${tableName}${this.columnEnumSuffix}]
                having: ${tableName}${this.whereSuffix}
            }

            ${Object.keys(foreignColumns)
                .map((table) => {
                    if (table === schema[0].tableNameCamelCase) {
                        return;
                    }

                    return `
                        input ${this.uppercaseFirstLetter(table)}${this.groupBySuffix} {
                            columns: [${this.uppercaseFirstLetter(table)}${this.columnEnumSuffix}]
                            having: ${this.uppercaseFirstLetter(table)}${this.whereSuffix}
                        }
                    `.trim();
                })
                .join("\n")}
        `.trim();
    };

    private buildColumnEqualities = (schema: TableSchema[]): string => {
        const tableName = schema[0].tableNamePascalCase;

        const colEqualities: string = `${schema.map((column) =>
            `${column.columnNameEntity}: EqualityTypes
            `.trim()
        )}`.trim();

        return `
            {
                ${colEqualities}
                and: [${tableName}${this.columnEqualitySuffix}]
                or: [${tableName}${this.columnEqualitySuffix}]
            }
        `.trim();
    };

    private buildResolvers = (
        schema: TableSchema[],
        foreignColumns: { [tableName: string]: TableSchema[] },
        databaseWorker: IDatabaseWorker
    ): any => {
        const tableName: string = schema[0].tableNameCamelCase;
        const completeForeignColumns: { [tableName: string]: TableSchema[] } = {};
        Object.keys(foreignColumns).map((table) => (completeForeignColumns[table] = this.tables[table]));
        const mergedSchema: { [tableName: string]: TableSchema[] } = {
            [tableName]: schema,
            ...completeForeignColumns,
        };

        return {
            Query: {
                [tableName]: async (_obj: any, args: any, context: any, info: any) => {
                    return await AwaitHelper.execute(
                        this.parseMaster.parseAstQuery(
                            databaseWorker.config.name,
                            args,
                            info,
                            context.omnihive,
                            mergedSchema
                        )
                    );
                },
            },
            Any: GraphQLAny,
        };
    };

    private uppercaseFirstLetter = (value: string): string => {
        return value[0].toUpperCase() + value.substr(1);
    };
}
