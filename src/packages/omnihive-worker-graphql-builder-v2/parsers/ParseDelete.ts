// import { GraphQLResolveInfo } from "graphql";
import { GraphContext } from "@withonevision/omnihive-core/models/GraphContext";
import { TableSchema } from "@withonevision/omnihive-core/models/TableSchema";
// import { GraphHelper } from "../helpers/GraphHelper";

export class ParseDelete {
    // Helpers
    // private graphHelper: GraphHelper = new GraphHelper();

    // Global Variables
    // private aliasKeyMapping: { name: string; alias: string }[] = [];

    public parse = async (
        workerName: string,
        tableKey: string,
        args: any,
        omniHiveContext: GraphContext,
        schema: { [tableName: string]: TableSchema[] }
    ): Promise<number> => {
        console.log(workerName);
        console.log(args);
        console.log(tableKey);
        console.log(omniHiveContext);
        console.log(schema[tableKey][0].tableNamePascalCase);

        return 0;
    };
}
