import { NodeServiceFactory } from "@withonevision/omnihive-core-node/factories/NodeServiceFactory";
import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { IDatabaseWorker } from "@withonevision/omnihive-core/interfaces/IDatabaseWorker";
import { ConnectionSchema } from "@withonevision/omnihive-core/models/ConnectionSchema";
import { TableSchema } from "@withonevision/omnihive-core/models/TableSchema";
import knex, { QueryBuilder } from "knex";

export class ParseUpdate {
    public parse = async (
        workerName: string,
        tableName: string,
        updateObject: any,
        whereObject: any,
        _customDmlArgs: any
    ): Promise<number> => {
        if (!whereObject || Object.keys(whereObject).length === 0) {
            throw new Error("Update cannot have no where objects/clause.  That is too destructive.");
        }

        if (!updateObject || Object.keys(updateObject).length === 0) {
            throw new Error("Update cannot have no columns to update.");
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
                            subWhere.orWhereRaw(`${columnSchema?.columnNameDatabase} ${split}`);
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
                            subWhere.orWhereRaw(`${columnSchema?.columnNameDatabase} ${split}`);
                        }
                    });
                });
            }
        });

        return await queryBuilder.update(updateDbObject);
    };
}
