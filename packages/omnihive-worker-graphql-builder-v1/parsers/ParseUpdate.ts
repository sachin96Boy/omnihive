import { HiveWorkerType } from "@withonevision/omnihive-hive-common/enums/HiveWorkerType";
import { AwaitHelper } from "@withonevision/omnihive-hive-common/helpers/AwaitHelper";
import { OmniHiveConstants } from "@withonevision/omnihive-hive-common/models/OmniHiveConstants";
import { TableSchema } from "@withonevision/omnihive-hive-common/models/TableSchema";
import { HiveWorkerFactory } from "@withonevision/omnihive-hive-worker/HiveWorkerFactory";
import { IFileSystemWorker } from "@withonevision/omnihive-hive-worker/interfaces/IFileSystemWorker";
import { IKnexDatabaseWorker } from "@withonevision/omnihive-hive-worker/interfaces/IKnexDatabaseWorker";
import { QueryBuilder } from "knex";

export class ParseUpdate {
    public parse = async (workerName: string, tableName: string, updateObject: any, whereObject: any, _customDmlArgs: any): Promise<number> => {

        if (!whereObject || Object.keys(whereObject).length === 0) {
            throw new Error("Update cannot have no where objects/clause.  That is too destructive.")
        }

        if (!updateObject || Object.keys(updateObject).length === 0) {
            throw new Error("Update cannot have no columns to update.");
        }

        const databaseWorker: IKnexDatabaseWorker | undefined = await AwaitHelper.execute<IKnexDatabaseWorker | undefined>(
            HiveWorkerFactory.getInstance().getHiveWorker<IKnexDatabaseWorker | undefined>(HiveWorkerType.Database, workerName));

        if (!databaseWorker) {
            throw new Error("Database Worker Not Defined.  This graph converter will not work without a Database worker.");
        }

        const fileSystemWorker: IFileSystemWorker | undefined = await AwaitHelper.execute<IFileSystemWorker | undefined>(
            HiveWorkerFactory.getInstance().getHiveWorker<IFileSystemWorker | undefined>(HiveWorkerType.FileSystem));

        if (!fileSystemWorker) {
            throw new Error("FileSystem Worker Not Defined.  This graph converter will not work without a FileSystem worker.");
        }

        const schemaFilePath: string = `${fileSystemWorker.getCurrentExecutionDirectory()}/${OmniHiveConstants.SERVER_OUTPUT_DIRECTORY}/connections/${workerName}.json`;
        const jsonSchema: any = JSON.parse(fileSystemWorker.readFile(schemaFilePath));

        let tableSchema: TableSchema[] = jsonSchema["tables"];
        tableSchema = tableSchema.filter((tableSchema: TableSchema) => tableSchema.tableName === tableName);

        const queryBuilder: QueryBuilder = databaseWorker.connection.queryBuilder();
        queryBuilder.from(tableName);

        const updateDbObject: any = {};

        Object.keys(updateObject).forEach((key: string) => {
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

            updateDbObject[columnSchema.columnNameDatabase] = updateObject[key];
        });

        Object.keys(whereObject).forEach((key: string, index: number) => {

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

            const whereSplitter: string[] = whereObject[key].toString().split("||");

            if (index === 0 && whereSplitter.length === 1) {
                queryBuilder.whereRaw(`${columnSchema.columnNameDatabase} ${whereObject[key]}`);
            }

            if (index > 0 && whereSplitter.length === 1) {
                queryBuilder.andWhereRaw(`${columnSchema.columnNameDatabase} ${whereObject[key]}`);
            }

            if (index === 0 && whereSplitter.length > 1) {
                queryBuilder.where((subWhere) => {
                    whereSplitter.forEach((split, subIndex) => {
                        if (subIndex === 0) {
                            subWhere.whereRaw(`${columnSchema?.columnNameDatabase} ${split}`);
                        } else {
                            subWhere.orWhereRaw(`${columnSchema?.columnNameDatabase} ${split}`)
                        }
                    });
                });
            }

            if (index > 0 && whereSplitter.length > 1) {
                queryBuilder.andWhere((subWhere) => {
                    whereSplitter.forEach((split, subIndex) => {
                        if (subIndex === 0) {
                            subWhere.whereRaw(`${columnSchema?.columnNameDatabase} ${split}`);
                        } else {
                            subWhere.orWhereRaw(`${columnSchema?.columnNameDatabase} ${split}`)
                        }
                    });
                });
            }
        });

        return await queryBuilder.update(updateDbObject);

    }
}