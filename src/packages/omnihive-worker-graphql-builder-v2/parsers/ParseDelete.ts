import { GraphContext } from "@withonevision/omnihive-core/models/GraphContext";
import { TableSchema } from "@withonevision/omnihive-core/models/TableSchema";
import { Knex } from "knex";
import { IDatabaseWorker } from "@withonevision/omnihive-core/interfaces/IDatabaseWorker";
import { IDateWorker } from "@withonevision/omnihive-core/interfaces/IDateWorker";
import { GraphHelper } from "../helpers/GraphHelper";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";

export class ParseDelete {
    // Workers
    private databaseWorker: IDatabaseWorker | undefined;
    private dateWorker: IDateWorker | undefined;

    // Helpers
    private graphHelper: GraphHelper = new GraphHelper();

    // Global Variables
    private schema: { [tableName: string]: TableSchema[] } = {};
    private knex: Knex | undefined;
    private builder: Knex.QueryBuilder<any, unknown[]> | undefined;

    /**
     * Parse the GraphQL Mutation
     *
     * @param workerName
     * @param tableKey
     * @param args
     * @param omniHiveContext
     * @param schema
     * @returns { Promise<number> }
     */
    public parse = async (
        workerName: string,
        tableKey: string,
        args: any,
        _omniHiveContext: GraphContext,
        schema: { [tableName: string]: TableSchema[] }
    ): Promise<number> => {
        try {
            this.schema = schema;

            // Set the required worker values
            const { databaseWorker, knex, dateWorker } = this.graphHelper.getRequiredWorkers(workerName);
            this.databaseWorker = databaseWorker;
            this.knex = knex;
            this.dateWorker = dateWorker;

            // Verify the authenticity of the access token
            // TODO: UNCOMMENT THIS LINE
            // await AwaitHelper.execute(this.graphHelper.verifyToken(omniHiveContext));

            const schemaColumns: TableSchema[] = this.schema[tableKey];
            let countingColumn = schemaColumns.find((x) => x.columnIsPrimaryKey);

            if (!countingColumn) {
                countingColumn = schemaColumns[0];
            }

            const mockStructure = {
                args: args,
                columns: [
                    {
                        name: countingColumn.columnNameEntity,
                        alias: "f0",
                        dbName: countingColumn.columnNameDatabase,
                    },
                ],
            };

            if (countingColumn) {
                this.buildProc(args, tableKey, countingColumn.columnNameDatabase);

                if (this.builder && this.databaseWorker) {
                    const dbResults = await AwaitHelper.execute(
                        this.databaseWorker.executeQuery(this.builder.toString())
                    );

                    const graphResults = this.graphHelper.buildGraphReturn(
                        mockStructure,
                        dbResults[0],
                        this.dateWorker,
                        false
                    );

                    return graphResults.length;
                }
            }

            return 0;
        } catch (err) {
            throw err;
        }
    };

    private buildProc = (args: any, tableKey: string, columnName: string): void => {
        if (!this.knex) {
            throw new Error("Knex object is not initialized");
        }

        this.builder = this.knex.queryBuilder();

        const schemaColumns: TableSchema[] = this.schema[tableKey];
        const tableName = schemaColumns[0].tableName;

        this.builder.from(`${tableName}`);

        this.graphHelper.buildConditions(args, "", this.builder, tableKey, this.schema, this.knex);

        this.builder.delete([columnName], { includeTriggerModifications: true });
    };
}
