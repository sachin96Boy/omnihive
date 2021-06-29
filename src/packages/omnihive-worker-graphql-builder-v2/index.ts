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
import { StringBuilder } from "@withonevision/omnihive-core/helpers/StringBuilder";
import { ProcFunctionSchema } from "@withonevision/omnihive-core/models/ProcFunctionSchema";
import { GraphQLJSON } from "@withonevision/omnihive-core/models/GraphQLJSON";

export default class GraphBuilder extends HiveWorkerBase implements IGraphBuildWorker {
    // Declare Helpers
    private graphHelper: GraphHelper = new GraphHelper();
    private parseMaster: ParseMaster = new ParseMaster();
    private builder: StringBuilder = new StringBuilder();

    // Declare Table Static Strings
    private objectSuffix: string = "Type";
    private whereSuffix: string = "WhereType";
    private orderBySuffix: string = "OrderType";
    private columnEnumSuffix: string = "ColumnEnum";
    private groupBySuffix: string = "GroupByType";
    private columnEqualitySuffix: string = "ColumnEqualityType";
    private joiningSuffix: string = "LinkingEnum";
    private joinTypeSuffix: string = "JoinType";
    private joinFieldSuffix: string = "_table";
    private mutationReturnTypeSuffix: string = "MutationReturnType";
    private insertTypeSuffix: string = "InsertType";
    private updateTypeSuffix: string = "UpdateType";
    private deleteTypeSuffix: string = "DeleteType";

    // Declare Global Variables
    private graphSchemas: GraphQLSchema[] = [];
    private tables: { [tableName: string]: TableSchema[] } = {};
    private storedProcs: { [procName: string]: ProcFunctionSchema[] } = {};

    /**
     * Build Database Worker GraphQL Schema
     *
     * @param databaseWorker
     * @param connectionSchema
     * @returns { GraphQLSchema }
     */
    public buildDatabaseWorkerSchema = (
        databaseWorker: IDatabaseWorker,
        connectionSchema: ConnectionSchema | undefined
    ): GraphQLSchema | undefined => {
        if (!connectionSchema) {
            return;
        }

        // Build table object
        //  Type: { [ tableNameCamelCase: string ]: TableSchema[] }
        for (const column of connectionSchema.tables) {
            if (!this.tables[column.tableNameCamelCase] || this.tables[column.tableNameCamelCase]?.length <= 0) {
                this.tables[column.tableNameCamelCase] = [];
            }

            if (!this.tables[column.tableNameCamelCase].some((t) => t.columnNameEntity == column.columnNameEntity)) {
                this.tables[column.tableNameCamelCase].push(column);
            }
        }

        // Iterate through each table and build it's graph schema
        for (const tableName in this.tables) {
            this.graphSchemas.push(this.buildExeSchema(this.tables[tableName], databaseWorker));
        }

        for (const parameter of connectionSchema.procFunctions) {
            if (!this.storedProcs[parameter.name] || this.storedProcs[parameter.name]?.length <= 0) {
                this.storedProcs[parameter.name] = [];
            }

            if (!this.storedProcs[parameter.name].some((t) => t.parameterName == parameter.parameterName)) {
                this.storedProcs[parameter.name].push(parameter);
            }
        }

        for (const proc in this.storedProcs) {
            this.graphSchemas.push(this.buildStoredProc(this.storedProcs[proc], databaseWorker));
        }

        return mergeSchemas({
            schemas: this.graphSchemas,
        });
    };

    //#region Builder

    /**
     * Build the GraphQL Schema for a specific table
     *
     * @param schema
     * @param databaseWorker
     * @returns { GraphQLSchema }
     */
    private buildExeSchema = (schema: TableSchema[], databaseWorker: IDatabaseWorker): GraphQLSchema => {
        // Clear string builder for new table processing
        this.builder.clear();

        // Get all the foreign keys
        const foreignColumns = this.findForeignKeys(schema);

        // Build GraphQL Type Definitions
        this.buildTypeDefinitions(schema, foreignColumns);
        const resolver = this.buildResolvers(schema, databaseWorker);

        return makeExecutableSchema({
            typeDefs: this.builder.outputString(),
            resolvers: resolver,
        });
    };

    /**
     * Find and store all the foreign links to and from the current table
     *
     * @param schema
     * @returns { [tableName: string]: TableSchema[] }
     */
    private findForeignKeys = (schema: TableSchema[]): { [tableName: string]: TableSchema[] } => {
        const foreignColumns: { [tableName: string]: TableSchema[] } = {};

        // Iterate through each column in the working table's schema
        schema.forEach((column) => {
            // Iterate through every table and see what links to the parent column
            Object.keys(this.tables).forEach((tableName) => {
                // Find any column in the current table that links to the parent column
                const match = this.tables[tableName].filter(
                    (x) =>
                        x.columnForeignKeyTableNameCamelCase === column.tableNameCamelCase &&
                        x.schemaName === column.schemaName &&
                        x.columnForeignKeyColumnName === column.columnNameDatabase
                );

                // Store the foreign column link if it is not already stored
                match.forEach((item) => {
                    if (item) {
                        if (!foreignColumns[item.tableNameCamelCase]) {
                            foreignColumns[item.tableNameCamelCase] = [];
                        }

                        if (
                            !foreignColumns[item.tableNameCamelCase].some(
                                (x) => item.columnNameEntity === x.columnNameEntity
                            )
                        )
                            foreignColumns[item.tableNameCamelCase].push(item);
                    }
                });
            });

            // Get the foreign links from the parent column to another table
            const linkToColumn: TableSchema[] = this.tables[column.columnForeignKeyTableNameCamelCase]?.filter(
                (x) => x.columnNameDatabase === column.columnForeignKeyColumnName
            );

            // Store any links from the parent column to another table if it is not stored already
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

    /**
     * Build the GraphQL Type Definition string
     *
     * @param schema
     * @param foreignColumns
     * @returns { void }
     */
    private buildTypeDefinitions = (
        schema: TableSchema[],
        foreignColumns: { [tableName: string]: TableSchema[] }
    ): void => {
        // Build static types
        this.buildStaticTypes();

        // Build query types
        this.buildLinkingEnum(schema[0].tableNameCamelCase, foreignColumns);
        this.buildColumnEqualityType(schema, foreignColumns);
        this.buildTableDef(schema, foreignColumns);
        this.buildWhereType(schema, foreignColumns);
        this.buildOrderByType(schema, foreignColumns);
        this.buildColumnEnum(schema, foreignColumns);
        this.buildGroupByType(schema, foreignColumns);

        // Build mutation types
        this.buildMutationReturnTableDef(schema);
        this.buildInsertType(schema);
        this.buildUpdateType(schema);
        this.buildDeleteType(schema);

        // Build parent types
        this.buildQueryDef(schema);
        this.buildMutationDef(schema);
    };
    //#endregion

    //#region Static Types

    /**
     * Build all the static types for all schemas
     *
     * @returns { void }
     */
    private buildStaticTypes = (): void => {
        // Custom Scalar type to allow any input for equality checks
        this.builder.appendLine("scalar Any");

        this.builder.appendLine();

        // Order By Enum options
        this.builder.appendLine("enum OrderByOptions {");
        this.builder.appendLine("\tasc");
        this.builder.appendLine("\tdesc");
        this.builder.appendLine("}");

        this.builder.appendLine();

        // Between Equality object
        this.builder.appendLine("input BetweenObject {");
        this.builder.appendLine("\tstart: Any!");
        this.builder.appendLine("\tend: Any!");
        this.builder.appendLine("}");

        this.builder.appendLine();

        // SQL Join options
        this.builder.appendLine("enum JoinOptions {");
        this.builder.appendLine("\tinner");
        this.builder.appendLine("\tleft");
        this.builder.appendLine("\tleftOuter");
        this.builder.appendLine("\tright");
        this.builder.appendLine("\trightOuter");
        this.builder.appendLine("\tfullOuter");
        this.builder.appendLine("\tcross");
        this.builder.appendLine("}");

        this.builder.appendLine();

        // Join where mode options
        // Determines if the were object is placed in the where of the query or the on of the join.
        this.builder.appendLine("enum WhereMode {");
        this.builder.appendLine("\tglobal");
        this.builder.appendLine("\tspecific");
        this.builder.appendLine("}");

        this.builder.appendLine();

        // Equality options
        this.builder.appendLine("input EqualityTypes {");
        this.builder.appendLine("\teq: Any");
        this.builder.appendLine("\tnotEq: Any");
        this.builder.appendLine("\tlike: Any");
        this.builder.appendLine("\tnotLike: Any");
        this.builder.appendLine("\tgt: Any");
        this.builder.appendLine("\tgte: Any");
        this.builder.appendLine("\tnotGt: Any");
        this.builder.appendLine("\tnotGte: Any");
        this.builder.appendLine("\tlt: Any");
        this.builder.appendLine("\tlte: Any");
        this.builder.appendLine("\tnotLt: Any");
        this.builder.appendLine("\tnotLte: Any");
        this.builder.appendLine("\tin: Any");
        this.builder.appendLine("\tnotIn: Any");
        this.builder.appendLine("\tisNull: Boolean");
        this.builder.appendLine("\tisNotNull: Boolean");
        this.builder.appendLine("\texists: Any");
        this.builder.appendLine("\tnotExists: Any");
        this.builder.appendLine("\tbetween: BetweenObject");
        this.builder.appendLine("\tnotBetween: BetweenObject");
        this.builder.appendLine("}");

        this.builder.appendLine();
    };
    //#endregion

    //#region Query Types

    /**
     * Build the table linking types
     *
     * @param parentTable
     * @param foreignColumns
     * @returns { void }
     */
    private buildLinkingEnum = (parentTable: string, foreignColumns: { [tableName: string]: TableSchema[] }): void => {
        // Iterate through each foreign table link
        for (const tableName in foreignColumns) {
            const schemaType = this.uppercaseFirstLetter(foreignColumns[tableName][0].schemaName);

            // If this table does not link to itself
            if (parentTable !== foreignColumns[tableName][0].tableNameCamelCase) {
                // Generate a placeholder type so the sub-schema can build correctly
                this.builder.appendLine(
                    `type ${schemaType}${this.uppercaseFirstLetter(tableName)}${this.objectSuffix} {`
                );
                foreignColumns[tableName].forEach((column) => {
                    this.builder.append(`\t${column.columnNameEntity}`);
                    this.builder.append(": ");
                    this.builder.appendLine(this.graphHelper.getGraphTypeFromDbType(column.columnTypeDatabase));
                });
                this.builder.appendLine("}");
                this.builder.appendLine();
            }

            const foreignLinks = foreignColumns[tableName].filter((x) => x.columnIsForeignKey);

            // If this link is linking to this table then provide an enum type to show what links to this table
            if (foreignLinks?.length > 0) {
                this.builder.append("enum ");

                // Build dynamic name for table linking enum
                this.builder.append(schemaType);
                this.builder.append(this.uppercaseFirstLetter(parentTable));
                this.builder.append(this.uppercaseFirstLetter(tableName));
                this.builder.append(this.joiningSuffix);

                this.builder.appendLine(" {");
                foreignLinks.forEach((column) => this.builder.appendLine(`\t${column.columnNameEntity}`));
                this.builder.appendLine("}");

                this.builder.appendLine();
            }

            // Building linking join input type
            this.builder.append("input ");
            this.builder.append(schemaType);
            this.builder.append(this.uppercaseFirstLetter(parentTable));
            this.builder.append(this.uppercaseFirstLetter(tableName));
            this.builder.append(this.joinTypeSuffix);
            this.builder.appendLine(" {");
            this.builder.appendLine("\ttype: JoinOptions");
            this.builder.appendLine("\twhereMode: WhereMode");

            // If this link is linking to this table then provide a from property
            if (foreignLinks?.length > 0) {
                this.builder.append("\tfrom: ");
                this.builder.append(schemaType);
                this.builder.append(this.uppercaseFirstLetter(parentTable));
                this.builder.append(this.uppercaseFirstLetter(tableName));
                this.builder.appendLine(this.joiningSuffix);
            }

            this.builder.appendLine("}");

            this.builder.appendLine();

            // If this is not a table linking to itself then provide a join input type
            if (tableName !== parentTable) {
                this.builder.append("input ");
                this.builder.append(schemaType);
                this.builder.append(this.uppercaseFirstLetter(tableName));
                this.builder.append(this.uppercaseFirstLetter(parentTable));
                this.builder.append(this.joinTypeSuffix);
                this.builder.appendLine(" {");
                this.builder.appendLine("\ttype: JoinOptions");
                this.builder.appendLine("\twhereMode: WhereMode");
                this.builder.appendLine("}");

                this.builder.appendLine();
            }
        }
    };

    /**
     * Build Column Equality input types for the where objects
     *
     * @param schema
     * @param foreignColumns
     * @returns  { void }
     */
    private buildColumnEqualityType = (
        schema: TableSchema[],
        foreignColumns: { [tableName: string]: TableSchema[] }
    ): void => {
        const schemaType = this.uppercaseFirstLetter(schema[0].schemaName);
        const tableName = schemaType + schema[0].tableNamePascalCase;

        this.builder.appendLine(`input ${tableName}${this.columnEqualitySuffix} {`);
        schema.map((column) => this.builder.appendLine(`\t${column.columnNameEntity}: EqualityTypes`));
        this.builder.appendLine("}");

        this.builder.appendLine();

        // Build temp foreign link equality input types so sub-schema builds properly
        Object.keys(foreignColumns).map((table) => {
            if (table === schema[0].tableNameCamelCase) {
                return;
            }

            this.builder.append("input ");
            this.builder.append(schemaType + this.uppercaseFirstLetter(table));
            this.builder.append(this.columnEqualitySuffix);
            this.builder.appendLine(" {");
            foreignColumns[table].map((column) =>
                this.builder.appendLine(`\t${column.columnNameEntity}: EqualityTypes`)
            );
            this.builder.appendLine("}");

            this.builder.appendLine();
        });
    };

    /**
     * Build main type definitions for the current table
     *
     * @param schema
     * @param foreignColumns
     * @returns { void }
     */
    private buildTableDef = (schema: TableSchema[], foreignColumns: { [tableName: string]: TableSchema[] }): void => {
        const schemaType = this.uppercaseFirstLetter(schema[0].schemaName);
        const tableName = schema[0].tableNamePascalCase;

        this.builder.appendLine(`type ${schemaType}${tableName}${this.objectSuffix} {`);
        schema.map((column) => {
            let columnType: string = this.graphHelper.getGraphTypeFromDbType(column.columnTypeDatabase);
            let columnDefault: string = `\t${column.columnNameEntity}: ${columnType}`;

            // Build all foreign linking declarations with argument typing
            if (column.columnIsForeignKey) {
                if (column.columnForeignKeyTableNameCamelCase === column.tableNameCamelCase) {
                    this.builder.appendLine(columnDefault);
                    this.builder.append(`\t${column.columnNameEntity}`);
                    this.builder.append(this.joinFieldSuffix);
                    this.builder.appendLine("(");
                    this.builder.append("\t\tjoin: ");
                    this.builder.append(schemaType);
                    this.builder.append(this.uppercaseFirstLetter(column.columnForeignKeyTableNamePascalCase));
                    this.builder.append(tableName);
                    this.builder.append(this.joinTypeSuffix);
                    this.builder.appendLine("!");
                    this.buildArgString(schema);
                    this.builder.append("\t)");
                } else {
                    this.builder.appendLine(columnDefault);
                    this.builder.append(`\t${column.columnNameEntity}`);
                    this.builder.append(this.joinFieldSuffix);
                    this.builder.appendLine("(");
                    this.builder.append("\t\tjoin: ");
                    this.builder.append(schemaType);
                    this.builder.append(tableName);
                    this.builder.append(this.uppercaseFirstLetter(column.columnForeignKeyTableNamePascalCase));
                    this.builder.append(this.joinTypeSuffix);
                    this.builder.appendLine("!");
                    this.buildArgString(foreignColumns[column.columnForeignKeyTableNameCamelCase]);
                    this.builder.append("\t)");
                }

                // Declare return type
                this.builder.append(": [");
                this.builder.append(schemaType);
                this.builder.append(column.columnForeignKeyTableNamePascalCase);
                this.builder.append(this.objectSuffix);
                this.builder.appendLine("]");
            } else {
                // Add standard field declaration
                this.builder.appendLine(columnDefault);
            }
        });

        // Build all foreign links that link to this table's columns with argument typing
        Object.keys(foreignColumns).map((table) => {
            const linkingSchema = schema.find((x) =>
                foreignColumns[table].find((y) => x.columnNameDatabase === y.columnForeignKeyColumnName)
            );

            if (
                !linkingSchema?.columnIsForeignKey &&
                linkingSchema?.columnForeignKeyTableNameCamelCase !== linkingSchema?.tableNameCamelCase
            ) {
                this.builder.appendLine(`\t${table}${this.joinFieldSuffix}(`);
                this.builder.append("\t\tjoin: ");
                this.builder.append(schemaType);
                this.builder.append(tableName);
                this.builder.append(this.uppercaseFirstLetter(table));
                this.builder.append(this.joinTypeSuffix);
                this.builder.appendLine("!");
                this.buildArgString(this.tables[table]);
                this.builder.appendLine("\t): [");
                this.builder.append(schemaType);
                this.builder.append(this.uppercaseFirstLetter(table));
                this.builder.append(this.objectSuffix);
                this.builder.append("]");
            }
        });
        this.builder.appendLine("}");

        this.builder.appendLine();
    };

    /**
     * Build argument string typing
     *
     * @param schema
     * @returns { void }
     */
    private buildArgString = (schema: TableSchema[]): void => {
        const schemaType = this.uppercaseFirstLetter(schema[0].schemaName);
        const tableName = schemaType + schema[0].tableNamePascalCase;

        this.builder.appendLine(`\t\twhere: ${tableName}${this.whereSuffix}`);
        this.builder.appendLine(`\t\torderBy: [${tableName}${this.orderBySuffix}]`);
        this.builder.appendLine(`\t\tgroupBy: ${tableName}${this.groupBySuffix}`);
    };

    /**
     * Build Where input types
     *
     * @param schema
     * @param foreignColumns
     * @returns { void }
     */
    private buildWhereType = (schema: TableSchema[], foreignColumns: { [tableName: string]: TableSchema[] }): void => {
        const schemaType = this.uppercaseFirstLetter(schema[0].schemaName);
        const tableName = schemaType + schema[0].tableNamePascalCase;

        this.builder.append(`input ${tableName}${this.whereSuffix}`);
        this.buildColumnEqualities(schema);

        // Add foreign link temp types so the sub-schema builds correctly
        Object.keys(foreignColumns).forEach((table) => {
            if (table === schema[0].tableNameCamelCase) {
                return;
            }

            this.builder.append("input ");
            this.builder.append(schemaType);
            this.builder.append(this.uppercaseFirstLetter(table));
            this.builder.append(this.whereSuffix);
            this.buildColumnEqualities(foreignColumns[table]);
        });
    };

    /**
     * Build OrderBy input type
     *
     * @param schema
     * @param foreignColumns
     * @returns { void }
     */
    private buildOrderByType = (
        schema: TableSchema[],
        foreignColumns: { [tableName: string]: TableSchema[] }
    ): void => {
        const schemaType = this.uppercaseFirstLetter(schema[0].schemaName);
        const tableName = schemaType + schema[0].tableNamePascalCase;

        this.builder.appendLine(`input ${tableName}${this.orderBySuffix} {`);
        schema.map((column) => this.builder.appendLine(`\t${column.columnNameEntity}: OrderByOptions`));
        this.builder.appendLine("}");

        this.builder.appendLine();

        // Add foreign link temp types so the sub-schema builds correctly
        Object.keys(foreignColumns).map((table) => {
            if (table === schema[0].tableNameCamelCase) {
                return;
            }

            this.builder.append("input ");
            this.builder.append(schemaType + this.uppercaseFirstLetter(table));
            this.builder.append(this.orderBySuffix);
            this.builder.appendLine(" {");

            foreignColumns[table].map((column) =>
                this.builder.appendLine(`\t${column.columnNameEntity}: OrderByOptions`)
            );
            this.builder.appendLine("}");

            this.builder.appendLine();
        });
    };

    /**
     * Build Column Enum type
     *
     * @param schema
     * @param foreignColumns
     * @returns { void }
     */
    private buildColumnEnum = (schema: TableSchema[], foreignColumns: { [tableName: string]: TableSchema[] }): void => {
        const schemaType = this.uppercaseFirstLetter(schema[0].schemaName);
        const tableName = schemaType + schema[0].tableNamePascalCase;

        this.builder.appendLine(`enum ${tableName}${this.columnEnumSuffix} {`);
        schema.map((column) => this.builder.appendLine(`\t${column.columnNameEntity}`));
        this.builder.appendLine("}");

        this.builder.appendLine();

        // Add foreign link temp types so the sub-schema builds correctly
        Object.keys(foreignColumns).map((table) => {
            if (table === schema[0].tableNameCamelCase) {
                return;
            }

            this.builder.append("enum ");
            this.builder.append(schemaType + this.uppercaseFirstLetter(table));
            this.builder.append(this.columnEnumSuffix);
            this.builder.appendLine(" {");
            foreignColumns[table].map((column) => this.builder.appendLine(`\t${column.columnNameEntity}`));
            this.builder.appendLine("}");

            this.builder.appendLine();
        });
    };

    /**
     * Build GroupBy input types
     *
     * @param schema
     * @param foreignColumns
     * @returns { void }
     */
    private buildGroupByType = (
        schema: TableSchema[],
        foreignColumns: { [tableName: string]: TableSchema[] }
    ): void => {
        const schemaType = this.uppercaseFirstLetter(schema[0].schemaName);
        const tableName = schemaType + schema[0].tableNamePascalCase;

        this.builder.appendLine(`input ${tableName}${this.groupBySuffix} {`);
        this.builder.append("\tcolumns: [");
        this.builder.append(tableName);
        this.builder.append(this.columnEnumSuffix);
        this.builder.appendLine("!]!");
        this.builder.append("\thaving: ");
        this.builder.append(tableName);
        this.builder.appendLine(this.whereSuffix);
        this.builder.appendLine("}");

        this.builder.appendLine();

        // Add foreign link temp types so the sub-schema builds correctly
        Object.keys(foreignColumns).map((table) => {
            if (table === schema[0].tableNameCamelCase) {
                return;
            }

            this.builder.append("input ");
            this.builder.append(schemaType + this.uppercaseFirstLetter(table));
            this.builder.append(this.groupBySuffix);
            this.builder.appendLine(" {");
            this.builder.append("\tcolumns: [");
            this.builder.append(schemaType + this.uppercaseFirstLetter(table));
            this.builder.append(this.columnEnumSuffix);
            this.builder.appendLine("!]!");
            this.builder.append("\thaving: ");
            this.builder.append(schemaType + this.uppercaseFirstLetter(table));
            this.builder.appendLine(this.whereSuffix);
            this.builder.appendLine("}");

            this.builder.appendLine();
        });
    };

    /**
     * Build Column Equality string
     *
     * @param schema
     * @returns { void }
     */
    private buildColumnEqualities = (schema: TableSchema[]): void => {
        const schemaType = this.uppercaseFirstLetter(schema[0].schemaName);
        const tableName = schemaType + schema[0].tableNamePascalCase;

        this.builder.appendLine(" {");
        schema.forEach((column) => this.builder.appendLine(`\t${column.columnNameEntity}: EqualityTypes`));
        this.builder.append("\tand: [");
        this.builder.append(tableName);
        this.builder.append(this.columnEqualitySuffix);
        this.builder.appendLine("]");
        this.builder.append("\tor: [");
        this.builder.append(tableName);
        this.builder.append(this.columnEqualitySuffix);
        this.builder.appendLine("]");
        this.builder.appendLine("}");

        this.builder.appendLine();
    };
    //#endregion

    //#region Mutation Types

    /**
     * Build main type definitions for the current table
     *
     * @param schema
     * @param foreignColumns
     * @returns { void }
     */
    private buildMutationReturnTableDef = (schema: TableSchema[]): void => {
        const schemaType = this.uppercaseFirstLetter(schema[0].schemaName);
        const tableName = schemaType + schema[0].tableNamePascalCase;

        this.builder.appendLine(`type ${tableName}${this.mutationReturnTypeSuffix} {`);
        schema.map((column) => {
            let columnType: string = this.graphHelper.getGraphTypeFromDbType(column.columnTypeDatabase);
            // Add standard field declaration
            this.builder.appendLine(`\t${column.columnNameEntity}: ${columnType}`);
        });
        this.builder.appendLine("}");

        this.builder.appendLine();
    };

    /**
     * Build Insert Input Type
     *
     * @param schema
     * @returns { void }
     */
    private buildInsertType = (schema: TableSchema[]): void => {
        const schemaType = this.uppercaseFirstLetter(schema[0].schemaName);
        const tableName = schemaType + schema[0].tableNamePascalCase;

        this.builder.appendLine(`input ${tableName}${this.insertTypeSuffix} {`);
        schema.forEach((column) => {
            // If the column is an identity it can not be changed so ignore it
            if (!column.columnIsIdentity) {
                this.builder.append(`\t${column.columnNameEntity}: `);
                this.builder.append(`${this.graphHelper.getGraphTypeFromDbType(column.columnTypeDatabase)}`);

                // If the column is not nullable then it is required
                if (!column.columnIsNullable) {
                    this.builder.append("!");
                }

                this.builder.appendLine();
            }
        });
        this.builder.appendLine("}");

        this.builder.appendLine();
    };

    /**
     * Build Update Input Type
     *
     * @param schema
     */
    private buildUpdateType = (schema: TableSchema[]): void => {
        const schemaType = this.uppercaseFirstLetter(schema[0].schemaName);
        const tableName = schemaType + schema[0].tableNamePascalCase;

        this.builder.appendLine(`input ${tableName}${this.updateTypeSuffix} {`);
        schema.forEach((column) => {
            if (!column.columnIsIdentity) {
                this.builder.append(`\t${column.columnNameEntity}: `);
                this.builder.append(`${this.graphHelper.getGraphTypeFromDbType(column.columnTypeDatabase)}`);
                this.builder.appendLine();
            }
        });
        this.builder.appendLine("}");

        this.builder.appendLine();
    };

    /**
     * Build Delete Input Type
     *
     * @param schema
     */
    private buildDeleteType = (schema: TableSchema[]): void => {
        const schemaType = this.uppercaseFirstLetter(schema[0].schemaName);
        const tableName = schemaType + schema[0].tableNamePascalCase;

        this.builder.appendLine(`input ${tableName}${this.deleteTypeSuffix} {`);
        schema.forEach((column) => {
            if (!column.columnIsIdentity) {
                this.builder.append(`\t${column.columnNameEntity}: `);
                this.builder.append(`${this.graphHelper.getGraphTypeFromDbType(column.columnTypeDatabase)}`);
                this.builder.appendLine();
            }
        });
        this.builder.appendLine("}");

        this.builder.appendLine();
    };
    //#endregion

    //#region

    /**
     * Build Parent Types
     *
     * @param schema
     * @returns { void }
     */
    private buildQueryDef = (schema: TableSchema[]): void => {
        const typeNamePrefix = schema[0].tableNamePascalCase;
        const propertyName: string = schema[0].schemaName + typeNamePrefix;

        this.builder.appendLine("type Query {");
        this.builder.append("\t");
        this.builder.append(propertyName);
        this.builder.appendLine(" (");
        this.buildArgString(schema);
        this.builder.append("\t): [");
        this.builder.append(this.uppercaseFirstLetter(propertyName));
        this.builder.append(this.objectSuffix);
        this.builder.appendLine("]");
        this.builder.appendLine("}");

        this.builder.appendLine();
    };

    private buildMutationDef = (schema: TableSchema[]): void => {
        const typeNamePrefix = schema[0].tableNamePascalCase;
        const propertyName: string = schema[0].schemaName + typeNamePrefix;

        this.builder.appendLine("type Mutation {");

        // Build insert type
        this.builder.append(`\tinsert_${propertyName} (`);
        this.builder.append(`insert: [${this.uppercaseFirstLetter(propertyName)}${this.insertTypeSuffix}!]!`);
        this.builder.appendLine(`): [${this.uppercaseFirstLetter(propertyName)}${this.mutationReturnTypeSuffix}]`);

        // Build update type
        this.builder.appendLine(`\tupdate_${propertyName} (`);
        this.builder.appendLine(`\t\tupdateTo: ${this.uppercaseFirstLetter(propertyName)}${this.updateTypeSuffix}!`);
        this.builder.appendLine(`\t\twhere: ${this.uppercaseFirstLetter(propertyName)}${this.whereSuffix}`);
        this.builder.appendLine(`\t): [${this.uppercaseFirstLetter(propertyName)}${this.mutationReturnTypeSuffix}]`);

        // Build delete type
        this.builder.append(`\tdelete_${propertyName} (`);
        this.builder.append(`where: ${this.uppercaseFirstLetter(propertyName)}${this.whereSuffix}`);
        this.builder.appendLine("): Int");

        this.builder.appendLine("}");

        this.builder.appendLine();
    };
    //#endregion

    //#region Resolvers
    /**
     * Build resolver for the current table and static scalar type
     *
     * @param schema
     * @param databaseWorker
     * @returns { any }
     */
    private buildResolvers = (schema: TableSchema[], databaseWorker: IDatabaseWorker): any => {
        const tableName: string = schema[0].tableNameCamelCase;
        const propertyName: string = schema[0].schemaName + schema[0].tableNamePascalCase;

        return {
            Query: {
                [propertyName]: async (_obj: any, args: any, context: any, info: any) => {
                    return await AwaitHelper.execute(
                        this.parseMaster.parseAstQuery(
                            databaseWorker.config.name,
                            args,
                            info,
                            context.omnihive,
                            this.tables
                        )
                    );
                },
            },
            Mutation: {
                [`insert_${propertyName}`]: async (_obj: any, _args: any, context: any, info: any) => {
                    return await AwaitHelper.execute(
                        this.parseMaster.parseInsert(
                            databaseWorker.config.name,
                            tableName,
                            info,
                            context.omnihive,
                            this.tables
                        )
                    );
                },
                [`update_${propertyName}`]: async (_obj: any, _args: any, context: any, info: any) => {
                    return await AwaitHelper.execute(
                        this.parseMaster.parseUpdate(
                            databaseWorker.config.name,
                            tableName,
                            info,
                            context.omnihive,
                            this.tables
                        )
                    );
                },
                [`delete_${propertyName}`]: async (_obj: any, args: any, context: any, _info: any) => {
                    return await AwaitHelper.execute(
                        this.parseMaster.parseDelete(
                            databaseWorker.config.name,
                            tableName,
                            args,
                            context.omnihive,
                            this.tables
                        )
                    );
                },
            },
            Any: GraphQLAny,
        };
    };
    //#endregion

    //#region Store Procedure Types

    private buildStoredProc = (proc: ProcFunctionSchema[], databaseWorker: IDatabaseWorker): GraphQLSchema => {
        // Clear string builder for new table processing
        this.builder.clear();

        // Build GraphQL Type Definitions
        this.buildProcTypeDefinitions(proc);
        this.buildQueryTypeDefinition();

        const resolver = this.buildProcResolvers(proc, databaseWorker);

        return makeExecutableSchema({
            typeDefs: this.builder.outputString(),
            resolvers: resolver,
        });
    };

    private buildProcTypeDefinitions = (proc: ProcFunctionSchema[]): void => {
        const typeName = `${proc[0].schemaName}_${proc[0].name}`;

        this.builder.appendLine("scalar JSON");

        this.builder.appendLine();

        this.builder.appendLine(`type Procedure {`);
        this.builder.appendLine(`\t${typeName}`);

        if (proc.filter((x) => x.parameterName).length > 0) {
            this.builder.appendLine("(");

            proc.forEach((param) => {
                if (!param.parameterName) {
                    return;
                }
                this.builder.append("\t\t");
                this.builder.append(param.parameterName.replace("@", ""));
                this.builder.append(": ");
                this.builder.appendLine(this.graphHelper.getGraphTypeFromDbType(param.parameterTypeDatabase));
            });

            this.builder.appendLine("\t)");
        }

        this.builder.appendLine(": [JSON]");
        this.builder.appendLine("}");

        this.builder.appendLine();
    };

    private buildQueryTypeDefinition = (): void => {
        this.builder.appendLine("type Query {");
        this.builder.appendLine(`\tprocedure: Procedure`);
        this.builder.appendLine("}");
    };

    private buildProcResolvers = (proc: ProcFunctionSchema[], databaseWorker: IDatabaseWorker): any => {
        const typeName = `${proc[0].schemaName}_${proc[0].name}`;

        return {
            Query: {
                procedure: async (_obj: any, _args: any, _context: any, _info: any) => {
                    return [];
                },
            },
            Procedure: {
                [typeName]: async (_obj: any, _args: any, context: any, info: any) => {
                    const workerName = databaseWorker.config.name;

                    return await AwaitHelper.execute(
                        this.parseMaster.parseProcedure(workerName, info, context.omnihive, proc)
                    );
                },
            },
            JSON: GraphQLJSON,
        };
    };
    //#endregion

    /**
     * Generic helper function to uppercase the first letter of a string
     *
     * @param value
     * @returns { string }
     */
    private uppercaseFirstLetter = (value: string): string => {
        return value[0].toUpperCase() + value.substr(1);
    };
}
