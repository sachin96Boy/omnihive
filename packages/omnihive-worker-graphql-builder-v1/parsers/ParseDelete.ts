import { HiveWorkerType } from "@withonevision/omnihive-queen/enums/HiveWorkerType";
import { AwaitHelper } from "@withonevision/omnihive-queen/helpers/AwaitHelper";
import { IFileSystemWorker } from "@withonevision/omnihive-queen/interfaces/IFileSystemWorker";
import { IKnexDatabaseWorker } from "@withonevision/omnihive-queen/interfaces/IKnexDatabaseWorker";
import { OmniHiveConstants } from "@withonevision/omnihive-queen/models/OmniHiveConstants";
import { TableSchema } from "@withonevision/omnihive-queen/models/TableSchema";
import { QueenStore } from "@withonevision/omnihive-queen/stores/QueenStore";
import { QueryBuilder } from "knex";

export class ParseDelete {
    public parse = async (workerName: string, tableName: string, whereObject: any, _customDmlArgs: any): Promise<number> => {

        if (!whereObject || Object.keys(whereObject).length === 0) {
            throw new Error("Delete cannot have no where objects/clause.  That is too destructive.")
        }

        const databaseWorker: IKnexDatabaseWorker | undefined = await AwaitHelper.execute<IKnexDatabaseWorker | undefined>(
            QueenStore.getInstance().getHiveWorker<IKnexDatabaseWorker | undefined>(HiveWorkerType.Database, workerName));

        if (!databaseWorker) {
            throw new Error("Database Worker Not Defined.  This graph converter will not work without a Database worker.");
        }

        const fileSystemWorker: IFileSystemWorker | undefined = await AwaitHelper.execute<IFileSystemWorker | undefined>(
            QueenStore.getInstance().getHiveWorker<IFileSystemWorker | undefined>(HiveWorkerType.FileSystem));

        if (!fileSystemWorker) {
            throw new Error("FileSystem Worker Not Defined.  This graph converter will not work without a FileSystem worker.");
        }

        const schemaFilePath: string = `${fileSystemWorker.getCurrentExecutionDirectory()}/${OmniHiveConstants.SERVER_OUTPUT_DIRECTORY}/connections/${workerName}.json`;
        const jsonSchema: any = JSON.parse(fileSystemWorker.readFile(schemaFilePath));

        let tableSchema: TableSchema[] = jsonSchema["tables"];
        tableSchema = tableSchema.filter((tableSchema: TableSchema) => tableSchema.tableName === tableName);

        const queryBuilder: QueryBuilder = databaseWorker.connection.queryBuilder();
        queryBuilder.from(tableName);

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

        return await queryBuilder.del();
    }
}