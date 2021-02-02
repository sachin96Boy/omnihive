import { NodeServiceFactory } from "@withonevision/omnihive-core-node/factories/NodeServiceFactory";
import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { IDatabaseWorker } from "@withonevision/omnihive-core/interfaces/IDatabaseWorker";
import { ConnectionSchema } from "@withonevision/omnihive-core/models/ConnectionSchema";
import { TableSchema } from "@withonevision/omnihive-core/models/TableSchema";
import knex, { QueryBuilder } from "knex";

export class ParseInsert {
    public parse = async (
        workerName: string,
        tableName: string,
        insertObjects: any[],
        _customDmlArgs: any
    ): Promise<any[]> => {
        if (!insertObjects || Object.keys(insertObjects).length === 0) {
            throw new Error("Insert cannot have a zero column count.");
        }

        const databaseWorker: IDatabaseWorker | undefined = await AwaitHelper.execute<IDatabaseWorker | undefined>(
            NodeServiceFactory.workerService.getWorker<IDatabaseWorker | undefined>(HiveWorkerType.Database, workerName)
        );

        if (!databaseWorker) {
            throw new Error(
                "Database Worker Not Defined.  This graph converter will not work without a Database worker."
            );
        }

        const schema: ConnectionSchema | undefined = NodeServiceFactory.connectionService.getSchema(workerName);
        let tableSchema: TableSchema[] = [];

        if (schema) {
            tableSchema = schema.tables;
        }
        tableSchema = tableSchema.filter((tableSchema: TableSchema) => tableSchema.tableName === tableName);

        const queryBuilder: QueryBuilder = (databaseWorker.connection as knex).queryBuilder();

        const insertDbObjects: any[] = [];
        const insertDbColumnList: string[] = [];

        insertObjects.forEach((insertObject: any) => {
            const insertDbObject: any = {};

            Object.keys(insertObject).forEach((key: string) => {
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

                insertDbObject[columnSchema.columnNameDatabase] = insertObject[key];

                if (!insertDbColumnList.some((value: string) => value === columnSchema?.columnNameDatabase)) {
                    insertDbColumnList.push(columnSchema.columnNameDatabase);
                }
            });

            insertDbObjects.push(insertDbObject);
        });

        return queryBuilder.insert(insertDbObjects, insertDbColumnList).into(tableName);
    };
}
