import { NodeServiceFactory } from "@withonevision/omnihive-core-node/factories/NodeServiceFactory";
import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { IDatabaseWorker } from "@withonevision/omnihive-core/interfaces/IDatabaseWorker";
import { ConnectionSchema } from "@withonevision/omnihive-core/models/ConnectionSchema";
import { StoredProcSchema } from "@withonevision/omnihive-core/models/StoredProcSchema";
import { FieldNode, GraphQLResolveInfo, SelectionNode } from "graphql";

export class ParseStoredProcedure {
    public parse = async (
        workerName: string,
        resolveInfo: GraphQLResolveInfo
    ): Promise<{ procName: string; results: any[][] }[]> => {
        const databaseWorker: IDatabaseWorker | undefined = await AwaitHelper.execute<IDatabaseWorker | undefined>(
            NodeServiceFactory.workerService.getWorker<IDatabaseWorker | undefined>(HiveWorkerType.Database, workerName)
        );

        if (!databaseWorker) {
            throw new Error(
                "Database Worker Not Defined.  This graph converter will not work without a database worker."
            );
        }

        const schema: ConnectionSchema | undefined = NodeServiceFactory.connectionService.getSchema(workerName);
        let fullSchema: StoredProcSchema[] = [];

        if (schema) {
            fullSchema = schema.storedProcs;
        }

        const response: { procName: string; results: any[][] }[] = [];

        const storedProcCall: readonly SelectionNode[] = resolveInfo.operation.selectionSet.selections;

        for (const call of storedProcCall) {
            const callFieldNode = call as FieldNode;
            const inputArgs: readonly SelectionNode[] | undefined = callFieldNode.selectionSet?.selections;

            if (!inputArgs) {
                throw new Error("Stored Procedure Graph Construction is Incorrect");
            }

            for (const selection of inputArgs) {
                const selectionFieldNode = selection as FieldNode;
                const proc: StoredProcSchema | undefined = fullSchema.find((s) => {
                    return s.storedProcName === selectionFieldNode.name.value;
                });

                if (!proc) {
                    throw new Error("Stored Procedure Graph Construction is Incorrect");
                }

                const procArgs: { name: string; value: any; isString: boolean }[] = [];

                selectionFieldNode.arguments?.forEach((args: any) => {
                    procArgs.push({
                        name: args.name.value,
                        value: args.value.value,
                        isString: args.value.kind === "StringValue",
                    });
                });

                response.push({
                    procName: proc.storedProcName,
                    results: await AwaitHelper.execute<any[][]>(databaseWorker.executeStoredProcedure(proc, procArgs)),
                });
            }
        }

        return response;
    };
}
