import { GraphQLResolveInfo } from "graphql";
import { GraphContext } from "@withonevision/omnihive-core/models/GraphContext";
import { TableSchema } from "@withonevision/omnihive-core/models/TableSchema";
import { GraphHelper } from "../helpers/GraphHelper";

export class ParseInsert {
    // Helpers
    private graphHelper: GraphHelper = new GraphHelper();

    // Global Variables
    private aliasKeyMapping: { name: string; alias: string }[] = [];

    public parse = async (
        workerName: string,
        tableKey: string,
        resolveInfo: GraphQLResolveInfo,
        omniHiveContext: GraphContext,
        schema: { [tableName: string]: TableSchema[] }
    ): Promise<any[]> => {
        console.log(workerName);

        const structure = this.graphHelper.buildQueryStructure(
            resolveInfo.fieldNodes,
            tableKey,
            0,
            this.aliasKeyMapping,
            tableKey,
            schema
        );

        console.log(structure);
        console.log(omniHiveContext);

        return [];
    };
}
