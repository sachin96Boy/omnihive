import { AwaitHelper, GraphContext, ProcFunctionSchema, TableSchema } from "@withonevision/omnihive-core/index.js";
import { GraphQLResolveInfo } from "graphql";
import { ParseAggregate } from "./ParseAggregate.js";
import { ParseAstQuery } from "./ParseAstQuery.js";
import { ParseCustomSql } from "./ParseCustomSql.js";
import { ParseDelete } from "./ParseDelete.js";
import { ParseInsert } from "./ParseInsert.js";
import { ParseProcedure } from "./ParseProcedure.js";
import { ParseUpdate } from "./ParseUpdate.js";

export class ParseMaster {
    public parseAstQuery = async (
        workerName: string,
        args: any,
        resolveInfo: GraphQLResolveInfo,
        omniHiveContext: GraphContext,
        schema: { [tableName: string]: TableSchema[] }
    ): Promise<any> => {
        const parser: ParseAstQuery = new ParseAstQuery();
        return await AwaitHelper.execute(parser.parse(workerName, args, resolveInfo, omniHiveContext, schema));
    };

    public parseAggregate = async (
        workerName: string,
        args: any,
        resolveInfo: GraphQLResolveInfo,
        omniHiveContext: GraphContext,
        schema: { [tableName: string]: TableSchema[] }
    ) => {
        const parser: ParseAggregate = new ParseAggregate();
        return await AwaitHelper.execute(parser.parse(workerName, args, resolveInfo, omniHiveContext, schema));
    };

    public parseDelete = async (
        workerName: string,
        tableKey: string,
        args: any,
        omniHiveContext: GraphContext,
        schema: { [tableName: string]: TableSchema[] }
    ): Promise<number> => {
        const parser: ParseDelete = new ParseDelete();

        return await AwaitHelper.execute(parser.parse(workerName, tableKey, args, omniHiveContext, schema));
    };

    public parseInsert = async (
        workerName: string,
        tableKey: string,
        resolveInfo: GraphQLResolveInfo,
        omniHiveContext: GraphContext,
        schema: { [tableName: string]: TableSchema[] }
    ): Promise<any[]> => {
        const parser: ParseInsert = new ParseInsert();
        return await AwaitHelper.execute(parser.parse(workerName, tableKey, resolveInfo, omniHiveContext, schema));
    };

    public parseUpdate = async (
        workerName: string,
        tableKey: string,
        resolveInfo: any,
        omniHiveContext: GraphContext,
        schema: { [tableName: string]: TableSchema[] }
    ): Promise<any[]> => {
        const parser: ParseUpdate = new ParseUpdate();
        return await AwaitHelper.execute(parser.parse(workerName, tableKey, resolveInfo, omniHiveContext, schema));
    };

    public parseProcedure = async (
        workerName: string,
        resolveInfo: GraphQLResolveInfo,
        omniHiveContext: GraphContext,
        procedureData: ProcFunctionSchema[]
    ): Promise<any[][]> => {
        const parser: ParseProcedure = new ParseProcedure();
        return await AwaitHelper.execute(parser.parse(workerName, resolveInfo, omniHiveContext, procedureData));
    };

    public parseCustomSql = async (
        workerName: string,
        encryptedSql: string,
        omniHiveContext: GraphContext
    ): Promise<any[][]> => {
        const parser: ParseCustomSql = new ParseCustomSql();
        return await AwaitHelper.execute(parser.parse(workerName, encryptedSql, omniHiveContext));
    };
}
