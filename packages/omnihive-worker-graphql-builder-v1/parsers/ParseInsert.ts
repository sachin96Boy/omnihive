import { HiveWorkerType } from "@withonevision/omnihive-common/enums/HiveWorkerType";
import { AwaitHelper } from "@withonevision/omnihive-common/helpers/AwaitHelper";
import { IFileSystemWorker } from "@withonevision/omnihive-common/interfaces/IFileSystemWorker";
import { IKnexDatabaseWorker } from "@withonevision/omnihive-common/interfaces/IKnexDatabaseWorker";
import { OmniHiveConstants } from "@withonevision/omnihive-common/models/OmniHiveConstants";
import { TableSchema } from "@withonevision/omnihive-common/models/TableSchema";
import { CommonStore } from "@withonevision/omnihive-common/stores/CommonStore";
import { QueryBuilder } from "knex";

export class ParseInsert {

    public parse = async (workerName: string, tableName: string, insertObjects: any[], _customDmlArgs: any): Promise<any[]> => {

        if (!insertObjects || Object.keys(insertObjects).length === 0) {
            throw new Error("Insert cannot have a zero column count.");
        }

        const databaseWorker: IKnexDatabaseWorker | undefined = await AwaitHelper.execute<IKnexDatabaseWorker | undefined>(
            CommonStore.getInstance().getHiveWorker<IKnexDatabaseWorker | undefined>(HiveWorkerType.Database, workerName));

        if (!databaseWorker) {
            throw new Error("Database Worker Not Defined.  This graph converter will not work without a Database worker.");
        }

        const fileSystemWorker: IFileSystemWorker | undefined = await AwaitHelper.execute<IFileSystemWorker | undefined>(
            CommonStore.getInstance().getHiveWorker<IFileSystemWorker | undefined>(HiveWorkerType.FileSystem));

        if (!fileSystemWorker) {
            throw new Error("FileSystem Worker Not Defined.  This graph converter will not work without a FileSystem worker.");
        }

        const schemaFilePath: string = `${fileSystemWorker.getCurrentExecutionDirectory()}/${OmniHiveConstants.SERVER_OUTPUT_DIRECTORY}/connections/${workerName}.json`;
        const jsonSchema: any = JSON.parse(fileSystemWorker.readFile(schemaFilePath));

        let tableSchema: TableSchema[] = jsonSchema["tables"];
        tableSchema = tableSchema.filter((tableSchema: TableSchema) => tableSchema.tableName === tableName);

        const queryBuilder: QueryBuilder = databaseWorker.connection.queryBuilder();

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
    }
}