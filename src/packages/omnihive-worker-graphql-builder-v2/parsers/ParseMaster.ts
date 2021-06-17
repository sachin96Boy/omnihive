import { GraphContext } from "@withonevision/omnihive-core/models/GraphContext";
import { GraphQLResolveInfo } from "graphql";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { ParseAstQuery } from "./ParseAstQuery";
import { TableSchema } from "src/packages/omnihive-core/models/TableSchema";

export class ParseMaster {
    public parseAstQuery = async (
        workerName: string,
        args: any,
        resolveInfo: GraphQLResolveInfo,
        omniHiveContext: GraphContext,
        schema: TableSchema[]
    ): Promise<any> => {
        const parser: ParseAstQuery = new ParseAstQuery();
        return await AwaitHelper.execute(parser.parse(workerName, args, resolveInfo, omniHiveContext, schema));
    };

    public parseCustomSql = async (
        _workerName: string,
        _encryptedSql: string,
        _omniHiveContext: GraphContext
    ): Promise<any[][]> => {
        return [];
    };

    public parseDelete = async (
        _workerName: string,
        _tableName: string,
        _whereObject: any,
        _customDmlArgs: any,
        _omniHiveContext: GraphContext
    ): Promise<number> => {
        return 0;
    };

    public parseInsert = async (
        _workerName: string,
        _tableName: string,
        _insertObjects: any[],
        _customDmlArgs: any,
        _omniHiveContext: GraphContext
    ): Promise<any[]> => {
        return [];
    };

    public parseProcedure = async (
        _workerName: string,
        _resolveInfo: GraphQLResolveInfo,
        _omniHiveContext: GraphContext
    ): Promise<{ procName: string; results: any[][] }[]> => {
        return [];
    };

    public parseUpdate = async (
        _workerName: string,
        _tableName: string,
        _updateObject: any,
        _whereObject: any,
        _customDmlArgs: any,
        _omniHiveContext: GraphContext
    ): Promise<number> => {
        return 0;
    };
}
