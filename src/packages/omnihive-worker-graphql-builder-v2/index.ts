import { HiveWorkerBase } from "@withonevision/omnihive-core/models/HiveWorkerBase";
import { IGraphStitchWorker } from "@withonevision/omnihive-core/interfaces/IGraphStitchWorker";
import { IDatabaseWorker } from "@withonevision/omnihive-core/interfaces/IDatabaseWorker";
import { ConnectionSchema } from "@withonevision/omnihive-core/models/ConnectionSchema";
import { TableSchema } from "@withonevision/omnihive-core/models/TableSchema";
import { GraphHelper } from "./helpers/GraphHelper";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { GraphQLSchema } from "graphql";
import { stitchSchemas } from "@graphql-tools/stitch";
import GraphQLAny from "./scalarTypes/GraphQLAny";
import { ParseMaster } from "./parsers/ParseMaster";

export default class GraphBuilder extends HiveWorkerBase implements IGraphStitchWorker {
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

    // Declare Global Variables
    private schemas: any = [];

    public buildDatabaseWorkerSchema = (
        databaseWorker: IDatabaseWorker,
        connectionSchema: ConnectionSchema | undefined
    ): GraphQLSchema | undefined => {
        if (!connectionSchema) {
            return;
        }

        const tables: { [tableName: string]: TableSchema[] } = {};

        for (const column of connectionSchema.tables) {
            if (!tables[column.tableNamePascalCase] || tables[column.tableNamePascalCase]?.length <= 0) {
                tables[column.tableNamePascalCase] = [];
            }

            if (!tables[column.tableNamePascalCase].some((t) => t.columnNameEntity == column.columnNameEntity)) {
                tables[column.tableNamePascalCase].push(column);
            }
        }

        for (const tableName in tables) {
            this.schemas.push(this.buildExeSchema(tables[tableName], databaseWorker));
        }

        return stitchSchemas({
            subschemas: this.schemas,
        });
    };

    private buildExeSchema = (schema: TableSchema[], databaseWorker: IDatabaseWorker): GraphQLSchema => {
        const typeDef: string = this.buildTypeDefinitions(schema);
        const resolvers: any = this.buildResolvers(schema, databaseWorker);

        return makeExecutableSchema({
            typeDefs: typeDef,
            resolvers: resolvers,
        });
    };

    private buildTypeDefinitions = (schema: TableSchema[]): string => `
            ${this.buildStaticTypes()}
            ${this.buildColumnEqualityType(schema)}
            ${this.buildTableDef(schema)}
            ${this.buildWhereType(schema)}
            ${this.buildOrderByType(schema)}
            ${this.buildColumnEnum(schema)}
            ${this.buildGroupByType(schema)}
            ${this.buildQueryDef(schema)}
        `;

    private buildStaticTypes = (): string => `
        scalar Any

        enum OrderByOptions {
            asc
            desc
        }
        
        input BetweenObject {
            start: Any
            end: Any
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
    `;

    private buildColumnEqualityType = (schema: TableSchema[]): string => {
        const tableName = schema[0].tableNamePascalCase;

        return `input ${tableName}${this.columnEqualitySuffix} {
            ${schema.map((column) => `${column.columnNameEntity}: EqualityTypes`)}
        }`;
    };

    private buildTableDef = (schema: TableSchema[]): string => {
        const tableName = schema[0].tableNamePascalCase;

        return `
            type ${tableName}${this.objectSuffix} {
                ${schema.map(
                    (column) =>
                        `${column.columnNameEntity}: ${this.graphHelper.getGraphTypeFromEntityType(
                            column.columnTypeEntity
                        )}`
                )}
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
        `;
    };

    private buildArgString = (schema: TableSchema[]): string => {
        const tableName = schema[0].tableNamePascalCase;

        return `
            where: ${tableName}${this.whereSuffix}
            orderBy: ${tableName}${this.orderBySuffix}
            distinctOn: ${tableName}${this.columnEnumSuffix}
            groupBy: ${tableName}${this.groupBySuffix}
        `;
    };

    private buildWhereType = (schema: TableSchema[]): string => {
        const tableName: string = schema[0].tableNamePascalCase;

        return `
            input ${tableName}${this.whereSuffix} 
            ${this.buildColumnEqualities(schema)}
            
        `;
    };

    private buildOrderByType = (schema: TableSchema[]): string => {
        const tableName = schema[0].tableNamePascalCase;

        return `
            input ${tableName}${this.orderBySuffix} {
                ${schema.map(
                    (column) => `
                    ${column.columnNameEntity}: OrderByOptions
                `
                )}
            }
        `;
    };

    private buildColumnEnum = (schema: TableSchema[]): string => {
        const tableName = schema[0].tableNamePascalCase;

        return `
            enum ${tableName}${this.columnEnumSuffix} {
                ${schema.map(
                    (column) => `
                    ${column.columnNameEntity}
                `
                )}
            }
        `;
    };

    private buildGroupByType = (schema: TableSchema[]): string => {
        const tableName = schema[0].tableNamePascalCase;

        return `
            input ${tableName}${this.groupBySuffix} {
                column: ${tableName}${this.columnEnumSuffix}
                having: ${tableName}${this.whereSuffix}
            }
        `;
    };

    private buildColumnEqualities = (schema: TableSchema[]): string => {
        const tableName = schema[0].tableNamePascalCase;

        const colEqualities: string = `${schema.map(
            (column) => `${column.columnNameEntity}: EqualityTypes
            `
        )}`;

        return `
            {
                ${colEqualities}
                and: [${tableName}${this.columnEqualitySuffix}]
                or: [${tableName}${this.columnEqualitySuffix}]
            }
        `;
    };

    private buildResolvers = (schema: TableSchema[], databaseWorker: IDatabaseWorker): any => {
        const tableName = schema[0].tableNameCamelCase;

        return {
            Query: {
                [tableName]: async (_obj: any, args: any, context: any, info: any) => {
                    return await AwaitHelper.execute(
                        this.parseMaster.parseAstQuery(databaseWorker.config.name, args, info, context.omnihive, schema)
                    );
                },
            },
            Any: GraphQLAny,
        };
    };
}
