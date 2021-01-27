import { GraphQLResolveInfo } from "graphql";
import { ParseAstQuery } from "./ParseAstQuery";
import { ParseCustomSql } from "./ParseCustomSql";
import { ParseDelete } from "./ParseDelete";
import { ParseInsert } from "./ParseInsert";
import { ParseStoredProcedure } from "./ParseStoredProcedure";
import { ParseUpdate } from "./ParseUpdate";

export class ParseMaster {
    public parseAstQuery = async (
        workerName: string,
        resolveInfo: GraphQLResolveInfo,
        cacheSetting: string,
        cacheTime: string
    ): Promise<any> => {
        const parser: ParseAstQuery = new ParseAstQuery();
        parser.parse(workerName, resolveInfo, cacheSetting, cacheTime);
    };

    public parseCustomSql = async (workerName: string, encryptedSql: string): Promise<any[][]> => {
        const parser: ParseCustomSql = new ParseCustomSql();
        return await parser.parse(workerName, encryptedSql);
    };

    public parseDelete = async (
        workerName: string,
        tableName: string,
        whereObject: any,
        customDmlArgs: any
    ): Promise<number> => {
        const parser: ParseDelete = new ParseDelete();
        return await parser.parse(workerName, tableName, whereObject, customDmlArgs);
    };

    public parseInsert = async (
        workerName: string,
        tableName: string,
        insertObjects: any[],
        customDmlArgs: any
    ): Promise<any[]> => {
        const parser: ParseInsert = new ParseInsert();
        return await parser.parse(workerName, tableName, insertObjects, customDmlArgs);
    };

    public parseStoredProcedure = async (
        workerName: string,
        resolveInfo: GraphQLResolveInfo
    ): Promise<{ procName: string; results: any[][] }[]> => {
        const parser: ParseStoredProcedure = new ParseStoredProcedure();
        return await parser.parse(workerName, resolveInfo);
    };

    public parseUpdate = async (
        workerName: string,
        tableName: string,
        updateObject: any,
        whereObject: any,
        customDmlArgs: any
    ): Promise<number> => {
        const parser: ParseUpdate = new ParseUpdate();
        return await parser.parse(workerName, tableName, updateObject, whereObject, customDmlArgs);
    };
}
