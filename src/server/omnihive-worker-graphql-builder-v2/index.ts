import { makeExecutableSchema, mergeSchemas } from "@graphql-tools/schema";
import { stitchSchemas, ValidationLevel } from "@graphql-tools/stitch";
import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { LifecycleWorkerAction } from "@withonevision/omnihive-core/enums/LifecycleWorkerAction";
import { LifecycleWorkerStage } from "@withonevision/omnihive-core/enums/LifecycleWorkerStage";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { IsHelper } from "@withonevision/omnihive-core/helpers/IsHelper";
import { StringBuilder } from "@withonevision/omnihive-core/helpers/StringBuilder";
import { IDatabaseWorker } from "@withonevision/omnihive-core/interfaces/IDatabaseWorker";
import { IGraphBuildWorker } from "@withonevision/omnihive-core/interfaces/IGraphBuildWorker";
import { ConnectionSchema } from "@withonevision/omnihive-core/models/ConnectionSchema";
import { GraphQLJSON } from "@withonevision/omnihive-core/models/GraphQLJSON";
import { HiveWorkerBase } from "@withonevision/omnihive-core/models/HiveWorkerBase";
import { HiveWorkerMetadataLifecycleFunction } from "@withonevision/omnihive-core/models/HiveWorkerMetadataLifecycleFunction";
import { ProcFunctionSchema } from "@withonevision/omnihive-core/models/ProcFunctionSchema";
import { RegisteredHiveWorker } from "@withonevision/omnihive-core/models/RegisteredHiveWorker";
import { TableSchema } from "@withonevision/omnihive-core/models/TableSchema";
import { GraphQLSchema } from "graphql";
import { GraphHelper } from "./helpers/GraphHelper";
import { ParseMaster } from "./parsers/ParseMaster";
import GraphBooleanDb from "./scalarTypes/GraphBooleanDb";
import GraphFloatDb from "./scalarTypes/GraphFloatDb";
import GraphIntDb from "./scalarTypes/GraphIntDb";
import GraphQLAny from "./scalarTypes/GraphQLAny";
import GraphStringDb from "./scalarTypes/GraphStringDb";
import { SubschemaConfig } from "@graphql-tools/delegate";
import { stitchingDirectives } from "@graphql-tools/stitching-directives";

type LifecycleData = {
    schema: string;
    tables: string[];
    order: number;
    action: LifecycleWorkerAction;
    stage: LifecycleWorkerStage;
    function: Function;
};

/** Notes for future:
 *
 * Linking File declared in metadata
 *
 * New building methodology
 *  1) Iterate asynchronously through each database worker and asynchronously generate the typeDefinitions and resolvers for each table
 *      1.1) Build columns for linking to other databases declared in the linking file provided by the database worker metadata
 *      1.2) Object holding typeDefinitions and resolvers:
 *              {
 *                  [name: string]: {
 *                      primary: {
 *                          dbWorkerName: string
 *                          table: string,
 *                          schema: string,
 *                          column: string,
 *                      },
 *                      linking: {
 *                          dbWorkerName: string
 *                          table: string,
 *                          schema: string,
 *                          column: string,
 *                      },
 *                  },
 *              }
 *  2) Iterate through each database worker generating the Graph Schema for that given worker using the types for each table
 *
 */

export default class GraphBuilder extends HiveWorkerBase implements IGraphBuildWorker {
    // Declare Helpers
    private typeDefinitions: string[] = [];
    private resolvers: any[] = [];
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
    private aggregateTypeSuffix: string = "AggregateType";
    private aggregateQuerySuffix: string = "_aggregate";
    private joinFieldSuffix: string = "_table";
    private mutationReturnTypeSuffix: string = "MutationReturnType";
    private insertTypeSuffix: string = "InsertType";
    private updateTypeSuffix: string = "UpdateType";
    private deleteTypeSuffix: string = "DeleteType";

    // Declare Global Variables
    private tables: { [tableName: string]: TableSchema[] } = {};
    private storedProcs: { [procName: string]: ProcFunctionSchema[] } = {};
    private lifecycleWorkers: LifecycleData[] = [];
    private currentLifecycleWorkers: {
        [action: string]: { [stage: string]: LifecycleData[] };
    } = {};

    /**
     * Build Database Worker GraphQL Schema
     *
     * @param databaseWorker
     * @param connectionSchema
     * @returns { GraphQLSchema }
     */
    public buildDatabaseWorkerSchema = async (
        databaseWorker: IDatabaseWorker,
        connectionSchema: ConnectionSchema | undefined
    ): Promise<GraphQLSchema | undefined> => {
        try {
            this.typeDefinitions = [];
            this.resolvers = [];
            this.tables = {};
            this.storedProcs = {};
            this.lifecycleWorkers = [];
            this.currentLifecycleWorkers = {};

            if (!connectionSchema) {
                return;
            }

            // Get all lifecycle workers
            const lifecycleRegisteredWorkers: RegisteredHiveWorker[] = this.registeredWorkers.filter(
                (rw: RegisteredHiveWorker) => rw.type === HiveWorkerType.DataLifecycleFunction
            );

            // Format lifecycle workers as usable object for future use
            lifecycleRegisteredWorkers.forEach((worker) => {
                const metadata: HiveWorkerMetadataLifecycleFunction = worker.metadata;
                if (worker.metadata.databaseWorker === databaseWorker.name) {
                    this.lifecycleWorkers.push({
                        schema: metadata.schema,
                        tables: IsHelper.isArray(metadata.tables) ? metadata.tables : [metadata.tables],
                        order: metadata.order,
                        action: metadata.action,
                        stage: metadata.stage,
                        function: worker.instance.execute,
                    });
                }
            });

            await Promise.all([
                // Build table object
                this.buildMainTableSchemas(connectionSchema, databaseWorker),

                // Build procedure object
                this.buildMainProcedureSchemas(connectionSchema, databaseWorker),

                // Build static custom sql schema
                this.buildMainCustomSqlSchema(databaseWorker),
            ]);

            return mergeSchemas({
                typeDefs: [this.typeDefinitions],
                resolvers: this.resolvers,
            });
        } catch (error) {
            throw error;
        }
    };

    /**
     * Build table schemas
     *
     * @param connectionSchema
     * @param databaseWorker
     */
    private buildMainTableSchemas = async (connectionSchema: ConnectionSchema, databaseWorker: IDatabaseWorker) => {
        try {
            //  Type: { [ tableNameCamelCase: string ]: TableSchema[] }
            await Promise.all(
                connectionSchema.tables.map((column: TableSchema) => this.buildTableSchemaObject(column))
            );

            // Iterate through each table and build it's graph schema

            await Promise.all(
                Object.keys(this.tables).map((tableName: string) =>
                    this.buildExeSchema(this.tables[tableName], databaseWorker)
                )
            );
        } catch (error) {
            throw error;
        }
    };

    private buildTableSchemaObject = async (column: TableSchema): Promise<void> => {
        const tableKey: string = column.schemaName + column.tableNamePascalCase;

        if (!this.tables[tableKey] || this.tables[tableKey]?.length <= 0) {
            this.tables[tableKey] = [];
        }

        if (!this.tables[tableKey].some((t) => t.columnNameEntity == column.columnNameEntity)) {
            this.tables[tableKey].push(column);
        }
    };

    private buildMainProcedureSchemas = async (connectionSchema: ConnectionSchema, databaseWorker: IDatabaseWorker) => {
        try {
            // Type: { [procedureName: string]: ProcFunctionSchema[] }
            await Promise.all(
                connectionSchema.procFunctions.map((parameter: ProcFunctionSchema) =>
                    this.buildProcSchemaObject(parameter)
                )
            );

            // Iterate through each procedure and build it's graph schema
            await Promise.all(
                Object.keys(this.storedProcs).map((proc: string) =>
                    this.buildProcSchema(this.storedProcs[proc], databaseWorker)
                )
            );
        } catch (error) {
            throw error;
        }
    };

    private buildProcSchemaObject = async (parameter: ProcFunctionSchema): Promise<void> => {
        const procKey: string = parameter.schemaName + "_" + parameter.name;
        if (!this.storedProcs[procKey] || this.storedProcs[procKey]?.length <= 0) {
            this.storedProcs[procKey] = [];
        }

        if (!this.storedProcs[procKey].some((t) => t.parameterName == parameter.parameterName)) {
            this.storedProcs[procKey].push(parameter);
        }
    };

    private buildMainCustomSqlSchema = async (databaseWorker: IDatabaseWorker) => {
        try {
            this.buildCustomSqlSchema(databaseWorker);
        } catch (error) {
            throw error;
        }
    };

    //#region Builder

    /**
     * Build the GraphQL Schema for a specific table
     *
     * @param schema
     * @param databaseWorker
     * @returns { GraphQLSchema }
     */
    private buildExeSchema = async (schema: TableSchema[], databaseWorker: IDatabaseWorker): Promise<void> => {
        try {
            // Clear string builder for new table processing
            this.builder.clear();

            this.getCurrentLifecycleWorkers(schema[0].tableName);

            // Get all the foreign keys
            const foreignColumns = this.findForeignKeys(schema);

            // Build GraphQL Type Definitions
            this.buildTypeDefinitions(schema, foreignColumns);
            const resolver = this.buildResolvers(schema, databaseWorker, foreignColumns);

            this.typeDefinitions.push(this.builder.outputString());
            this.resolvers.push(resolver);
        } catch (error) {
            throw error;
        }
    };

    /**
     * Gets the valid worker for the given action and schema/table
     *
     * @param tableKey
     * @param action
     * @returns { void }
     */
    private getCurrentLifecycleWorkers = (tableKey: string): void => {
        // Reset object for new table
        this.currentLifecycleWorkers = {};

        // Iterate through each lifecycle worker for the server
        this.lifecycleWorkers.forEach((worker) => {
            // If the worker is valid for the given action and table
            if (worker.tables.some((x) => x === tableKey || x === "*")) {
                let index: number = 0;
                let action: string = this.getActionString(worker.action);
                let stage: string = this.getStageString(worker.stage);

                if (worker.stage === LifecycleWorkerStage.None) {
                    return;
                }

                if (!this.currentLifecycleWorkers[action]) {
                    this.currentLifecycleWorkers[action] = {};
                }

                if (!this.currentLifecycleWorkers[action][stage]) {
                    this.currentLifecycleWorkers[action][stage] = [];
                }

                // Find the proper index the worker should live based on it's order
                this.currentLifecycleWorkers[action][stage].forEach((item, i) => {
                    if (item.order > worker.order && i < index) {
                        index = i;
                    } else {
                        index = ++i;
                    }
                });

                // Insert the worker into its proper location
                this.currentLifecycleWorkers[action][stage] = [
                    ...this.currentLifecycleWorkers[action][stage].slice(0, index),
                    worker,
                    ...this.currentLifecycleWorkers[action][stage].slice(index),
                ];
            }
        });
    };

    /**
     * Get the lifecycle action string
     *
     * @param action
     * @returns
     */
    private getActionString = (action: LifecycleWorkerAction): string => {
        switch (action) {
            case LifecycleWorkerAction.Insert:
                return "insert";
            case LifecycleWorkerAction.Update:
                return "update";
            case LifecycleWorkerAction.Delete:
                return "delete";
            case LifecycleWorkerAction.None:
                return "none";
        }
    };

    /**
     * Get the lifecycle stage string
     *
     * @param stage
     * @returns
     */
    private getStageString = (stage: LifecycleWorkerStage): string => {
        switch (stage) {
            case LifecycleWorkerStage.Before:
                return "before";
            case LifecycleWorkerStage.InsteadOf:
                return "instead";
            case LifecycleWorkerStage.After:
                return "after";
            case LifecycleWorkerStage.None:
                return "none";
        }
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
                    const tableKey: string = item.schemaName + item.tableNamePascalCase;
                    if (item) {
                        if (!foreignColumns[tableKey]) {
                            foreignColumns[tableKey] = [];
                        }

                        if (!foreignColumns[tableKey].some((x) => item.columnNameEntity === x.columnNameEntity))
                            foreignColumns[tableKey].push(item);
                    }
                });
            });

            const foreignTableKey = column.schemaName + column.columnForeignKeyTableNamePascalCase;
            // Get the foreign links from the parent column to another table
            const linkToColumn: TableSchema[] = this.tables[foreignTableKey]?.filter(
                (x) => x.columnNameDatabase === column.columnForeignKeyColumnName
            );

            // Store any links from the parent column to another table if it is not stored already
            linkToColumn?.forEach((key) => {
                const tableKey: string = key.schemaName + key.tableNamePascalCase;

                if (key) {
                    if (!foreignColumns[tableKey]) {
                        foreignColumns[tableKey] = [];
                    }

                    if (!foreignColumns[tableKey].some((x) => key.columnNameEntity === x.columnNameEntity)) {
                        foreignColumns[tableKey].push(key);
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
        this.buildLinkingEnum(schema[0].schemaName + schema[0].tableNamePascalCase, foreignColumns);
        this.buildColumnEqualityType(schema, foreignColumns);
        this.buildAggregateType(schema, foreignColumns);
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
        this.builder.appendLine("scalar DbBoolean");
        this.builder.appendLine("scalar DbFloat");
        this.builder.appendLine("scalar DbInt");
        this.builder.appendLine("scalar DbString");

        this.builder.appendLine();

        // Order By Enum options
        this.builder.appendLine("enum OrderByOptions {");
        this.builder.appendLine("\tasc");
        this.builder.appendLine("\tdesc");
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

        // Booleans
        // Equality options
        this.builder.appendLine("input EqualityTypesBoolean {");
        this.builder.appendLine("\teq: DbBoolean");
        this.builder.appendLine("\tnotEq: DbBoolean");
        this.builder.appendLine("\tlike: DbBoolean");
        this.builder.appendLine("\tnotLike: DbBoolean");
        this.builder.appendLine("\tgt: DbBoolean");
        this.builder.appendLine("\tgte: DbBoolean");
        this.builder.appendLine("\tnotGt: DbBoolean");
        this.builder.appendLine("\tnotGte: DbBoolean");
        this.builder.appendLine("\tlt: DbBoolean");
        this.builder.appendLine("\tlte: DbBoolean");
        this.builder.appendLine("\tnotLt: DbBoolean");
        this.builder.appendLine("\tnotLte: DbBoolean");
        this.builder.appendLine("\tin: [DbBoolean!]");
        this.builder.appendLine("\tnotIn: [DbBoolean!]");
        this.builder.appendLine("\tisNull: Boolean");
        this.builder.appendLine("\tisNotNull: Boolean");
        this.builder.appendLine("\texists: DbBoolean");
        this.builder.appendLine("\tnotExists: DbBoolean");
        this.builder.appendLine("\tbetween: BetweenObjectBoolean");
        this.builder.appendLine("\tnotBetween: BetweenObjectBoolean");
        this.builder.appendLine("}");

        this.builder.appendLine();

        // Between Equality object
        this.builder.appendLine("input BetweenObjectBoolean {");
        this.builder.appendLine("\tstart: DbBoolean!");
        this.builder.appendLine("\tend: DbBoolean!");
        this.builder.appendLine("}");

        this.builder.appendLine();

        // Float
        // Equality options
        this.builder.appendLine("input EqualityTypesFloat {");
        this.builder.appendLine("\teq: DbFloat");
        this.builder.appendLine("\tnotEq: DbFloat");
        this.builder.appendLine("\tlike: DbFloat");
        this.builder.appendLine("\tnotLike: DbFloat");
        this.builder.appendLine("\tgt: DbFloat");
        this.builder.appendLine("\tgte: DbFloat");
        this.builder.appendLine("\tnotGt: DbFloat");
        this.builder.appendLine("\tnotGte: DbFloat");
        this.builder.appendLine("\tlt: DbFloat");
        this.builder.appendLine("\tlte: DbFloat");
        this.builder.appendLine("\tnotLt: DbFloat");
        this.builder.appendLine("\tnotLte: DbFloat");
        this.builder.appendLine("\tin: [DbFloat!]");
        this.builder.appendLine("\tnotIn: [DbFloat!]");
        this.builder.appendLine("\tisNull: Boolean");
        this.builder.appendLine("\tisNotNull: Boolean");
        this.builder.appendLine("\texists: DbFloat");
        this.builder.appendLine("\tnotExists: DbFloat");
        this.builder.appendLine("\tbetween: BetweenObjectFloat");
        this.builder.appendLine("\tnotBetween: BetweenObjectFloat");
        this.builder.appendLine("}");

        this.builder.appendLine();

        // Between Equality object
        this.builder.appendLine("input BetweenObjectFloat {");
        this.builder.appendLine("\tstart: DbFloat!");
        this.builder.appendLine("\tend: DbFloat!");
        this.builder.appendLine("}");

        this.builder.appendLine();

        // Int
        // Equality options
        this.builder.appendLine("input EqualityTypesInt {");
        this.builder.appendLine("\teq: DbInt");
        this.builder.appendLine("\tnotEq: DbInt");
        this.builder.appendLine("\tlike: DbInt");
        this.builder.appendLine("\tnotLike: DbInt");
        this.builder.appendLine("\tgt: DbInt");
        this.builder.appendLine("\tgte: DbInt");
        this.builder.appendLine("\tnotGt: DbInt");
        this.builder.appendLine("\tnotGte: DbInt");
        this.builder.appendLine("\tlt: DbInt");
        this.builder.appendLine("\tlte: DbInt");
        this.builder.appendLine("\tnotLt: DbInt");
        this.builder.appendLine("\tnotLte: DbInt");
        this.builder.appendLine("\tin: [DbInt!]");
        this.builder.appendLine("\tnotIn: [DbInt!]");
        this.builder.appendLine("\tisNull: Boolean");
        this.builder.appendLine("\tisNotNull: Boolean");
        this.builder.appendLine("\texists: DbInt");
        this.builder.appendLine("\tnotExists: DbInt");
        this.builder.appendLine("\tbetween: BetweenObjectInt");
        this.builder.appendLine("\tnotBetween: BetweenObjectInt");
        this.builder.appendLine("}");

        this.builder.appendLine();

        // Between Equality object
        this.builder.appendLine("input BetweenObjectInt {");
        this.builder.appendLine("\tstart: DbInt!");
        this.builder.appendLine("\tend: DbInt!");
        this.builder.appendLine("}");

        this.builder.appendLine();

        // String
        // Equality options
        this.builder.appendLine("input EqualityTypesString {");
        this.builder.appendLine("\teq: DbString");
        this.builder.appendLine("\tnotEq: DbString");
        this.builder.appendLine("\tlike: DbString");
        this.builder.appendLine("\tnotLike: DbString");
        this.builder.appendLine("\tgt: DbString");
        this.builder.appendLine("\tgte: DbString");
        this.builder.appendLine("\tnotGt: DbString");
        this.builder.appendLine("\tnotGte: DbString");
        this.builder.appendLine("\tlt: DbString");
        this.builder.appendLine("\tlte: DbString");
        this.builder.appendLine("\tnotLt: DbString");
        this.builder.appendLine("\tnotLte: DbString");
        this.builder.appendLine("\tin: [DbString!]");
        this.builder.appendLine("\tnotIn: [DbString!]");
        this.builder.appendLine("\tisNull: Boolean");
        this.builder.appendLine("\tisNotNull: Boolean");
        this.builder.appendLine("\texists: DbString");
        this.builder.appendLine("\tnotExists: DbString");
        this.builder.appendLine("\tbetween: BetweenObjectString");
        this.builder.appendLine("\tnotBetween: BetweenObjectString");
        this.builder.appendLine("}");

        this.builder.appendLine();

        // Between Equality object
        this.builder.appendLine("input BetweenObjectString {");
        this.builder.appendLine("\tstart: DbString!");
        this.builder.appendLine("\tend: DbString!");
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
            // If this table does not link to itself
            if (parentTable !== tableName) {
                // Generate a placeholder type so the sub-schema can build correctly
                this.builder.appendLine(`type ${this.uppercaseFirstLetter(tableName)}${this.objectSuffix} {`);
                foreignColumns[tableName].forEach((column) => {
                    this.builder.append(`\t${column.columnNameEntity}`);
                    this.builder.append(": ");
                    this.builder.appendLine(this.graphHelper.getGraphReturnTypeFromDbType(column.columnTypeDatabase));
                });
                this.builder.appendLine("}");
                this.builder.appendLine();
            }

            const foreignLinks = foreignColumns[tableName].filter((x) => x.columnIsForeignKey);

            // If this link is linking to this table then provide an enum type to show what links to this table
            if (foreignLinks?.length > 0) {
                this.builder.append("enum ");

                // Build dynamic name for table linking enum
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
            this.builder.append(this.uppercaseFirstLetter(parentTable));
            this.builder.append(this.uppercaseFirstLetter(tableName));
            this.builder.append(this.joinTypeSuffix);
            this.builder.appendLine(" {");
            this.builder.appendLine("\ttype: JoinOptions");
            this.builder.appendLine("\twhereMode: WhereMode");

            // If this link is linking to this table then provide a from property
            if (foreignLinks?.length > 0) {
                this.builder.append("\tfrom: ");
                this.builder.append(this.uppercaseFirstLetter(parentTable));
                this.builder.append(this.uppercaseFirstLetter(tableName));
                this.builder.appendLine(this.joiningSuffix);
            }

            this.builder.appendLine("}");

            this.builder.appendLine();

            // If this is not a table linking to itself then provide a join input type
            if (tableName !== parentTable) {
                this.builder.append("input ");
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
        const tableKey = schema[0].schemaName + schema[0].tableNamePascalCase;

        this.builder.appendLine(`input ${tableName}${this.columnEqualitySuffix} {`);
        schema.map((column) =>
            this.builder.appendLine(
                `\t${column.columnNameEntity}: ${this.graphHelper.getGraphEqualityTypeFromDbType(
                    column.columnTypeDatabase
                )}`
            )
        );
        this.builder.appendLine("}");

        this.builder.appendLine();

        // Build temp foreign link equality input types so sub-schema builds properly
        Object.keys(foreignColumns).map((table) => {
            if (table === tableKey) {
                return;
            }

            this.builder.append("input ");
            this.builder.append(this.uppercaseFirstLetter(table));
            this.builder.append(this.columnEqualitySuffix);
            this.builder.appendLine(" {");
            foreignColumns[table].map((column) =>
                this.builder.appendLine(
                    `\t${column.columnNameEntity}: ${this.graphHelper.getGraphEqualityTypeFromDbType(
                        column.columnTypeDatabase
                    )}`
                )
            );
            this.builder.appendLine("}");

            this.builder.appendLine();
        });
    };

    private buildAggregateType = (
        schema: TableSchema[],
        foreignColumns: { [tableName: string]: TableSchema[] }
    ): void => {
        const schemaType = this.uppercaseFirstLetter(schema[0].schemaName);
        const tableName = schemaType + schema[0].tableNamePascalCase;
        const tableKey = schema[0].schemaName + schema[0].tableNamePascalCase;

        this.builder.appendLine(`type ${tableName}${this.aggregateTypeSuffix} {`);
        this.builder.append("\tcount(column: ");
        this.builder.append(tableName + this.columnEnumSuffix);
        this.builder.appendLine("!");
        this.builder.appendLine("\t\tdistinct: Boolean");
        this.builder.appendLine("\t): Int");
        this.builder.append("\tmin(column: ");
        this.builder.append(tableName + this.columnEnumSuffix);
        this.builder.appendLine("!");
        this.builder.appendLine("\t): Any");
        this.builder.append("\tmax(column: ");
        this.builder.append(tableName + this.columnEnumSuffix);
        this.builder.appendLine("!");
        this.builder.appendLine("\t): Any");
        this.builder.append("\tsum(column: ");
        this.builder.append(tableName + this.columnEnumSuffix);
        this.builder.appendLine("!");
        this.builder.appendLine("\t\tdistinct: Boolean");
        this.builder.appendLine("\t): Any");
        this.builder.append("\tavg(column: ");
        this.builder.append(tableName + this.columnEnumSuffix);
        this.builder.appendLine("!");
        this.builder.appendLine("\t\tdistinct: Boolean");
        this.builder.appendLine("\t): Any");
        this.builder.appendLine("}");

        this.builder.appendLine();

        // Build temp foreign link equality input types so sub-schema builds properly
        Object.keys(foreignColumns).map((table) => {
            if (table === tableKey) {
                return;
            }

            const tableTypeName: string = this.uppercaseFirstLetter(table);

            this.builder.appendLine(`type ${tableTypeName}${this.aggregateTypeSuffix} {`);
            this.builder.append("\tcount(column: ");
            this.builder.append(tableTypeName + this.columnEnumSuffix);
            this.builder.appendLine("!");
            this.builder.appendLine("\t\tdistinct: Boolean");
            this.builder.appendLine("\t): Int");
            this.builder.append("\tmin(column: ");
            this.builder.append(tableTypeName + this.columnEnumSuffix);
            this.builder.appendLine("!");
            this.builder.appendLine("\t): Any");
            this.builder.append("\tmax(column: ");
            this.builder.append(tableTypeName + this.columnEnumSuffix);
            this.builder.appendLine("!");
            this.builder.appendLine("\t): Any");
            this.builder.append("\tsum(column: ");
            this.builder.append(tableTypeName + this.columnEnumSuffix);
            this.builder.appendLine("!");
            this.builder.appendLine("\t\tdistinct: Boolean");
            this.builder.appendLine("\t): Any");
            this.builder.append("\tavg(column: ");
            this.builder.append(tableTypeName + this.columnEnumSuffix);
            this.builder.appendLine("!");
            this.builder.appendLine("\t\tdistinct: Boolean");
            this.builder.appendLine("\t): Any");
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
        const tableName = schemaType + schema[0].tableNamePascalCase;

        this.builder.appendLine(`type ${tableName}${this.objectSuffix} {`);
        schema.map((column) => {
            let columnType: string = this.graphHelper.getGraphReturnTypeFromDbType(column.columnTypeDatabase);
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
                    this.builder.append(tableName);
                    this.builder.append(schemaType);
                    this.builder.append(this.uppercaseFirstLetter(column.columnForeignKeyTableNamePascalCase));
                    this.builder.append(this.joinTypeSuffix);
                    this.builder.appendLine("!");
                    this.buildArgString(foreignColumns[column.schemaName + column.columnForeignKeyTableNamePascalCase]);
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
                // Standard Join
                this.builder.appendLine(`\t${table}${this.joinFieldSuffix}(`);
                this.builder.append("\t\tjoin: ");
                this.builder.append(tableName);
                this.builder.append(this.uppercaseFirstLetter(table));
                this.builder.append(this.joinTypeSuffix);
                this.builder.appendLine("!");
                this.buildArgString(this.tables[table]);
                this.builder.appendLine("\t): [");
                this.builder.append(this.uppercaseFirstLetter(table));
                this.builder.append(this.objectSuffix);
                this.builder.append("]");

                // Aggregate Join
                this.builder.appendLine(`\t${table}${this.aggregateQuerySuffix}(`);
                this.builder.append("\t\tjoin: ");
                this.builder.append(tableName);
                this.builder.append(this.uppercaseFirstLetter(table));
                this.builder.append(this.joinTypeSuffix);
                this.builder.appendLine("!");
                this.buildArgString(this.tables[table]);
                this.builder.appendLine("\t): ");
                this.builder.append(this.uppercaseFirstLetter(table));
                this.builder.append(this.aggregateTypeSuffix);
                this.builder.append("");
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
        this.builder.appendLine(`\t\tlimit: Int = ${this.metadata.rowLimit ?? 10000}`);
        this.builder.appendLine(`\t\tpage: Int = ${this.metadata.rowLimit ?? 1}`);
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
        const tableKey = schema[0].schemaName + schema[0].tableNamePascalCase;

        this.builder.append(`input ${tableName}${this.whereSuffix}`);
        this.buildColumnEqualities(schema);

        // Add foreign link temp types so the sub-schema builds correctly
        Object.keys(foreignColumns).forEach((table) => {
            if (table === tableKey) {
                return;
            }

            this.builder.append("input ");
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
        const tableKey = schema[0].schemaName + schema[0].tableNamePascalCase;

        this.builder.appendLine(`input ${tableName}${this.orderBySuffix} {`);
        schema.map((column) => this.builder.appendLine(`\t${column.columnNameEntity}: OrderByOptions`));
        this.builder.appendLine("}");

        this.builder.appendLine();

        // Add foreign link temp types so the sub-schema builds correctly
        Object.keys(foreignColumns).map((table) => {
            if (table === tableKey) {
                return;
            }

            this.builder.append("input ");
            this.builder.append(this.uppercaseFirstLetter(table));
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
        const tableKey = schema[0].schemaName + schema[0].tableNamePascalCase;

        this.builder.appendLine(`enum ${tableName}${this.columnEnumSuffix} {`);
        schema.map((column) => this.builder.appendLine(`\t${column.columnNameEntity}`));
        this.builder.appendLine("}");

        this.builder.appendLine();

        // Add foreign link temp types so the sub-schema builds correctly
        Object.keys(foreignColumns).map((table) => {
            if (table === tableKey) {
                return;
            }

            this.builder.append("enum ");
            this.builder.append(this.uppercaseFirstLetter(table));
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
        const tableKey = schema[0].schemaName + schema[0].tableNamePascalCase;

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
            if (table === tableKey) {
                return;
            }

            this.builder.append("input ");
            this.builder.append(this.uppercaseFirstLetter(table));
            this.builder.append(this.groupBySuffix);
            this.builder.appendLine(" {");
            this.builder.append("\tcolumns: [");
            this.builder.append(this.uppercaseFirstLetter(table));
            this.builder.append(this.columnEnumSuffix);
            this.builder.appendLine("!]!");
            this.builder.append("\thaving: ");
            this.builder.append(this.uppercaseFirstLetter(table));
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
        schema.forEach((column) =>
            this.builder.appendLine(
                `\t${column.columnNameEntity}: ${this.graphHelper.getGraphEqualityTypeFromDbType(
                    column.columnTypeDatabase
                )}`
            )
        );
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
            let columnType: string = this.graphHelper.getGraphReturnTypeFromDbType(column.columnTypeDatabase);
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
        if (schema.filter((x) => !x.columnIsIdentity).length > 0) {
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
        }
    };

    /**
     * Build Update Input Type
     *
     * @param schema
     */
    private buildUpdateType = (schema: TableSchema[]): void => {
        if (schema.filter((x) => !x.columnIsIdentity).length > 0) {
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
        }
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
            this.builder.append(`\t${column.columnNameEntity}: `);
            this.builder.append(`${this.graphHelper.getGraphTypeFromDbType(column.columnTypeDatabase)}`);
            this.builder.appendLine();
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
        this.builder.append("\t");
        this.builder.append(propertyName);
        this.builder.append(this.aggregateQuerySuffix);
        this.builder.appendLine(" (");
        this.buildArgString(schema);
        this.builder.append("\t): ");
        this.builder.append(this.uppercaseFirstLetter(propertyName));
        this.builder.append(this.aggregateTypeSuffix);
        this.builder.appendLine("}");

        this.builder.appendLine();
    };

    private buildMutationDef = (schema: TableSchema[]): void => {
        const typeNamePrefix = schema[0].tableNamePascalCase;
        const propertyName: string = schema[0].schemaName + typeNamePrefix;
        const identityOnly: boolean = schema.filter((x) => !x.columnIsIdentity).length <= 0;

        // Set relevant flags
        const insertLifecycle = this.currentLifecycleWorkers["insert"] ? true : false;
        const updateLifecycle = this.currentLifecycleWorkers["update"] ? true : false;
        const deleteLifecycle = this.currentLifecycleWorkers["delete"] ? true : false;

        this.builder.appendLine("type Mutation {");

        // Build insert type
        if (!identityOnly) {
            this.builder.append(`\tinsert_${propertyName} (`);
            this.builder.append(`insert: [${this.uppercaseFirstLetter(propertyName)}${this.insertTypeSuffix}!]!`);

            if (insertLifecycle) {
                this.builder.append(`lifecycleArgs: Any`);
            }
            this.builder.appendLine(`): [${this.uppercaseFirstLetter(propertyName)}${this.mutationReturnTypeSuffix}]`);
        }

        // Build update type
        if (!identityOnly) {
            this.builder.appendLine(`\tupdate_${propertyName} (`);
            this.builder.appendLine(
                `\t\tupdateTo: ${this.uppercaseFirstLetter(propertyName)}${this.updateTypeSuffix}!`
            );
            this.builder.appendLine(`\t\twhere: ${this.uppercaseFirstLetter(propertyName)}${this.whereSuffix}`);
            if (updateLifecycle) {
                this.builder.append(`lifecycleArgs: Any`);
            }
            this.builder.appendLine(
                `\t): [${this.uppercaseFirstLetter(propertyName)}${this.mutationReturnTypeSuffix}]`
            );
        }

        // Build delete type
        this.builder.append(`\tdelete_${propertyName} (`);
        this.builder.append(`where: ${this.uppercaseFirstLetter(propertyName)}${this.whereSuffix}`);
        if (deleteLifecycle) {
            this.builder.append(`lifecycleArgs: Any`);
        }
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
    private buildResolvers = (
        schema: TableSchema[],
        databaseWorker: IDatabaseWorker,
        foreignColumns: {
            [tableName: string]: TableSchema[];
        }
    ): any => {
        const propertyName: string = schema[0].schemaName + schema[0].tableNamePascalCase;
        const identityOnly: boolean = schema.filter((x) => !x.columnIsIdentity).length <= 0;

        // Build mutation functions with any lifecycle custom changes
        const insertFunction = this.buildInsertFunction(databaseWorker, propertyName);
        const updateFunction = this.buildUpdateFunction(databaseWorker, propertyName);
        const deleteFunction = this.buildDeleteFunction(databaseWorker, propertyName);

        const tableSchema = { ...this.tables };

        const resolver: any = {
            Query: {
                [propertyName]: async (_obj: any, args: any, context: any, info: any) => {
                    return await AwaitHelper.execute(
                        this.parseMaster.parseAstQuery(databaseWorker.name, args, info, context.omnihive, tableSchema)
                    );
                },
                [propertyName + this.aggregateQuerySuffix]: async (_obj: any, args: any, context: any, info: any) => {
                    return await AwaitHelper.execute(
                        this.parseMaster.parseAggregate(databaseWorker.name, args, info, context.omnihive, tableSchema)
                    );
                },
            },
            Mutation: {
                [`delete_${propertyName}`]: deleteFunction,
            },
            Any: GraphQLAny,
            DbBoolean: GraphBooleanDb,
            DbFloat: GraphFloatDb,
            DbInt: GraphIntDb,
            DbString: GraphStringDb,
        };

        if (!identityOnly) {
            resolver.Mutation[`insert_${propertyName}`] = insertFunction;
            resolver.Mutation[`update_${propertyName}`] = updateFunction;
        }

        for (const column in foreignColumns) {
            const tableName: string =
                foreignColumns[column][0].schemaName + foreignColumns[column][0].tableNamePascalCase;

            const resolverKey: string = this.uppercaseFirstLetter(propertyName) + this.objectSuffix;

            if (!foreignColumns[column].some((x) => x.columnIsForeignKey)) {
                continue;
            }

            if (!resolver[resolverKey]) {
                resolver[resolverKey] = {};
            }

            resolver[resolverKey][tableName + this.aggregateQuerySuffix] = async (
                _obj: any,
                args: any,
                context: any,
                info: any
            ) => {
                return await AwaitHelper.execute(
                    this.parseMaster.parseAggregate(databaseWorker.name, args, info, context.omnihive, tableSchema)
                );
            };
        }

        return resolver;
    };

    /**
     * Build the insert function
     *
     * @param databaseWorker
     * @param propertyName
     * @returns { Function }
     */
    private buildInsertFunction = (databaseWorker: IDatabaseWorker, propertyName: string): Function => {
        const tableSchema = { ...this.tables };

        // Set default insert function
        const defaultInsert = async (_obj: any, _args: any, context: any, info: any) => {
            return await AwaitHelper.execute(
                this.parseMaster.parseInsert(databaseWorker.name, propertyName, info, context.omnihive, tableSchema)
            );
        };

        // Build insert function with any custom lifecycle functions added in
        return this.buildMutationResolver(LifecycleWorkerAction.Insert, defaultInsert);
    };

    /**
     * Build the update function
     *
     * @param databaseWorker
     * @param propertyName
     * @returns { Function }
     */
    private buildUpdateFunction = (databaseWorker: IDatabaseWorker, propertyName: string): Function => {
        const tableSchema = { ...this.tables };

        // Set default update function
        const defaultUpdate = async (_obj: any, _args: any, context: any, info: any) => {
            return await AwaitHelper.execute(
                this.parseMaster.parseUpdate(databaseWorker.name, propertyName, info, context.omnihive, tableSchema)
            );
        };

        // Build update function with any custom lifecycle functions added in
        return this.buildMutationResolver(LifecycleWorkerAction.Update, defaultUpdate);
    };

    /**
     * Build the delete function
     *
     * @param databaseWorker
     * @param propertyName
     * @returns { Function }
     */
    private buildDeleteFunction = (databaseWorker: IDatabaseWorker, propertyName: string): Function => {
        const tableSchema = { ...this.tables };

        // Set default delete function
        const defaultDelete = async (_obj: any, args: any, context: any, _info: any) => {
            return await AwaitHelper.execute(
                this.parseMaster.parseDelete(databaseWorker.name, propertyName, args, context.omnihive, tableSchema)
            );
        };

        // Build delete function with any custom lifecycle functions added in
        return this.buildMutationResolver(LifecycleWorkerAction.Delete, defaultDelete);
    };

    /**
     * Build the mutation resolver function
     *
     * @param tableKey
     * @param action
     * @param defaultFunction
     * @returns { Function }
     */
    private buildMutationResolver = (action: string, defaultFunction: Function): Function => {
        // If no custom workers were found return the default function
        if (!this.currentLifecycleWorkers[action]) {
            return defaultFunction;
        }

        const beforeFunctions: Function[] = [];

        if (this.currentLifecycleWorkers[action].before) {
            this.currentLifecycleWorkers[action].before.forEach((worker) => {
                beforeFunctions.push(worker.function);
            });
        }

        const insteadFunctions: Function[] = [];

        if (this.currentLifecycleWorkers[action].instead) {
            this.currentLifecycleWorkers[action].instead.forEach((worker) => {
                insteadFunctions.push(worker.function);
            });
        }

        const afterFunctions: Function[] = [];

        if (this.currentLifecycleWorkers[action].after) {
            this.currentLifecycleWorkers[action].after.forEach((worker) => {
                afterFunctions.push(worker.function);
            });
        }

        // Build the resolver function with the lifecycle functions in the correct place and order
        return async (obj: any, args: any, context: any, info: any) => {
            // Initialize return object
            let response: any;

            // Iterate through each before lifecycle worker and set the response object
            beforeFunctions.forEach((f) => (response = f(response, obj, args, context, info)));

            // Iterate through each instead of lifecycle worker and set the response object
            if (insteadFunctions && insteadFunctions.length > 0) {
                insteadFunctions.forEach((f) => {
                    response = f(response, obj, args, context, info);
                });
            }
            // If no instead of lifecycle workers were present add the default function and set the response object
            else {
                response = defaultFunction;
            }

            // Iterate through each after lifecycle worker and set the response object
            afterFunctions.forEach((f) => {
                response = f(response, obj, args, context, info);
            });

            return response;
        };
    };
    //#endregion

    //#region Store Procedure Types

    /**
     * Build Procedure Schemas
     *
     * @param proc
     * @param databaseWorker
     * @returns { GraphQLSchema }
     */
    private buildProcSchema = async (proc: ProcFunctionSchema[], databaseWorker: IDatabaseWorker): Promise<void> => {
        // Clear string builder for new table processing
        this.builder.clear();

        // Build GraphQL Type Definitions
        this.buildProcTypeDefinitions(proc);
        this.buildQueryTypeDefinition();

        // Build resolvers
        const resolver = this.buildProcResolvers(proc, databaseWorker);

        this.typeDefinitions.push(this.builder.outputString());
        this.resolvers.push(resolver);
    };

    /**
     * Build Procedure types
     *
     * @param proc
     * @returns { void }
     */
    private buildProcTypeDefinitions = (proc: ProcFunctionSchema[]): void => {
        // Build name with the schema name
        const typeName = `${proc[0].schemaName}_${proc[0].name.replace(/[^a-zA-Z0-9_]/g, "_")}`;

        // Define custom return scalar type
        this.builder.appendLine("scalar JSON");

        this.builder.appendLine();

        // Build procedure type
        this.builder.appendLine(`type Procedure {`);
        this.builder.appendLine(`\t${typeName}`);

        // If parameters exist then build the procedures arguments
        if (proc.filter((x) => x.parameterName).length > 0) {
            this.builder.appendLine("(");

            // Iterate through each parameter for the given procedure and build the arguments
            proc.forEach((param) => {
                if (!param.parameterName) {
                    return;
                }
                this.builder.append("\t\t");
                // Remove the @ decorator from the parameter name
                this.builder.append(param.parameterName.replace("@", ""));
                this.builder.append(": ");
                this.builder.appendLine(this.graphHelper.getGraphReturnTypeFromDbType(param.parameterTypeDatabase));
            });

            this.builder.appendLine("\t)");
        }

        this.builder.appendLine(": [JSON]");
        this.builder.appendLine("}");

        this.builder.appendLine();
    };

    /**
     * Build the Query type for the given procedure
     *
     * @returns { void }
     */
    private buildQueryTypeDefinition = (): void => {
        this.builder.appendLine("type Query {");
        this.builder.appendLine(`\tprocedure: Procedure`);
        this.builder.appendLine("}");
    };

    /**
     * Build the Procedure's resolver
     *
     * @param proc
     * @param databaseWorker
     * @returns { any }
     */
    private buildProcResolvers = (proc: ProcFunctionSchema[], databaseWorker: IDatabaseWorker): any => {
        const typeName = `${proc[0].schemaName}_${proc[0].name.replace(/[^a-zA-Z0-9_]/g, "_")}`;
        const procSchema: ProcFunctionSchema[] = [...proc];

        return {
            Query: {
                procedure: async (_obj: any, _args: any, _context: any, _info: any) => {
                    return [];
                },
            },
            Procedure: {
                [typeName]: async (_obj: any, _args: any, context: any, info: any) => {
                    const workerName = databaseWorker.name;

                    return await AwaitHelper.execute(
                        this.parseMaster.parseProcedure(workerName, info, context.omnihive, procSchema)
                    );
                },
            },
            JSON: GraphQLJSON,
        };
    };
    //#endregion

    //#region Custom SQL

    /**
     * Build the Custom Sql Schema
     *
     * @returns { GraphQLSchema }
     */
    private buildCustomSqlSchema = (databaseWorker: IDatabaseWorker): void => {
        // Clear string builder for new table processing
        this.builder.clear();

        // Build GraphQL Type Definitions
        this.buildCustomSqlType();

        // Build resolvers
        const resolver = this.buildCustomSqlResolvers(databaseWorker);

        this.typeDefinitions.push(this.builder.outputString());
        this.resolvers.push(resolver);
    };

    /**
     * Build the Query type for the customSql call
     *
     * @returns { void }
     */
    private buildCustomSqlType = (): void => {
        this.builder.appendLine("scalar JSON");
        this.builder.appendLine();
        this.builder.appendLine("type Query {");
        this.builder.appendLine("\tcustomSql(encryptedSql: String): JSON");
        this.builder.appendLine("}");
    };

    /**
     * Build the custom Sql resolver
     *
     * @returns { any }
     */
    private buildCustomSqlResolvers = (databaseWorker: IDatabaseWorker): any => {
        return {
            Query: {
                customSql: async (_obj: any, args: any, context: any, _info: any) => {
                    const graphParser = new ParseMaster();
                    const dbResponse = await AwaitHelper.execute(
                        graphParser.parseCustomSql(databaseWorker.name, args.encryptedSql, context.omnihive)
                    );

                    return [{ recordset: dbResponse }];
                },
            },
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
