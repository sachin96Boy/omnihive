/// <reference path="../../../types/globals.omnihive.d.ts" />

import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { StringHelper } from "@withonevision/omnihive-core/helpers/StringHelper";
import { IDatabaseWorker } from "@withonevision/omnihive-core/interfaces/IDatabaseWorker";
import { IFeatureWorker } from "@withonevision/omnihive-core/interfaces/IFeatureWorker";
import { ITokenWorker } from "@withonevision/omnihive-core/interfaces/ITokenWorker";
import { ConnectionSchema } from "@withonevision/omnihive-core/models/ConnectionSchema";
import { GraphContext } from "@withonevision/omnihive-core/models/GraphContext";
import { ProcSchema } from "@withonevision/omnihive-core/models/ProcSchema";
import { FieldNode, GraphQLResolveInfo, SelectionNode } from "graphql";

export class ParseProcedure {
    public parse = async (
        workerName: string,
        resolveInfo: GraphQLResolveInfo,
        omniHiveContext: GraphContext
    ): Promise<{ procName: string; results: any[][] }[]> => {
        const databaseWorker: IDatabaseWorker | undefined = global.omnihive.getWorker<IDatabaseWorker | undefined>(
            HiveWorkerType.Database,
            workerName
        );

        if (!databaseWorker) {
            throw new Error(
                "Database Worker Not Defined.  This graph converter will not work without a database worker."
            );
        }

        const featureWorker: IFeatureWorker | undefined = global.omnihive.getWorker<IFeatureWorker | undefined>(
            HiveWorkerType.Feature
        );

        const tokenWorker: ITokenWorker | undefined = global.omnihive.getWorker<ITokenWorker | undefined>(
            HiveWorkerType.Token
        );

        let disableSecurity = false;

        if (featureWorker) {
            disableSecurity =
                (await AwaitHelper.execute(featureWorker?.get<boolean>("disableSecurity", false))) ?? false;
        }

        if (!disableSecurity && !tokenWorker) {
            throw new Error("[ohAccessError] No token worker defined.");
        }

        if (
            !disableSecurity &&
            tokenWorker &&
            (!omniHiveContext || !omniHiveContext.access || StringHelper.isNullOrWhiteSpace(omniHiveContext.access))
        ) {
            throw new Error("[ohAccessError] Access token is invalid or expired.");
        }

        if (
            !disableSecurity &&
            tokenWorker &&
            omniHiveContext &&
            omniHiveContext.access &&
            !StringHelper.isNullOrWhiteSpace(omniHiveContext.access)
        ) {
            const verifyToken: boolean = await AwaitHelper.execute(tokenWorker.verify(omniHiveContext.access));
            if (verifyToken === false) {
                throw new Error("[ohAccessError] Access token is invalid or expired.");
            }
        }

        const schema: ConnectionSchema | undefined = global.omnihive.registeredSchemas.find(
            (value: ConnectionSchema) => value.workerName === workerName
        );
        let fullSchema: ProcSchema[] = [];

        if (schema) {
            fullSchema = schema.procs;
        }

        const response: { procName: string; results: any[][] }[] = [];

        const procCall: readonly SelectionNode[] = resolveInfo.operation.selectionSet.selections;

        for (const call of procCall) {
            const callFieldNode = call as FieldNode;
            const inputArgs: readonly SelectionNode[] | undefined = callFieldNode.selectionSet?.selections;

            if (!inputArgs) {
                throw new Error("Procedure Graph Construction is Incorrect");
            }

            for (const selection of inputArgs) {
                const selectionFieldNode = selection as FieldNode;
                const proc: ProcSchema | undefined = fullSchema.find((s) => {
                    return s.procName === selectionFieldNode.name.value;
                });

                if (!proc) {
                    throw new Error("Procedure Graph Construction is Incorrect");
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
                    procName: proc.procName,
                    results: await AwaitHelper.execute(databaseWorker.executeProcedure(proc, procArgs)),
                });
            }
        }

        return response;
    };
}
