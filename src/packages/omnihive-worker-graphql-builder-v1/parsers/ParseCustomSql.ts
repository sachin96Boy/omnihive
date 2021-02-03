import { NodeServiceFactory } from "@withonevision/omnihive-core-node/factories/NodeServiceFactory";
import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { IDatabaseWorker } from "@withonevision/omnihive-core/interfaces/IDatabaseWorker";
import { IEncryptionWorker } from "@withonevision/omnihive-core/interfaces/IEncryptionWorker";

export class ParseCustomSql {
    public parse = async (workerName: string, encryptedSql: string): Promise<any[][]> => {
        const encryptionWorker: IEncryptionWorker | undefined = await AwaitHelper.execute<
            IEncryptionWorker | undefined
        >(NodeServiceFactory.workerService.getWorker<IEncryptionWorker | undefined>(HiveWorkerType.Encryption));

        if (!encryptionWorker) {
            throw new Error(
                "Encryption Worker Not Defined.  This graph converter will not work without an Encryption worker."
            );
        }

        const databaseWorker: IDatabaseWorker | undefined = await AwaitHelper.execute<IDatabaseWorker | undefined>(
            NodeServiceFactory.workerService.getWorker<IDatabaseWorker | undefined>(HiveWorkerType.Database, workerName)
        );

        if (!databaseWorker) {
            throw new Error(
                "Database Worker Not Defined.  This graph converter will not work without a Database worker."
            );
        }

        const decryptedSql = encryptionWorker.symmetricDecrypt(encryptedSql);
        return await AwaitHelper.execute<any[][]>(databaseWorker.executeQuery(decryptedSql));
    };
}
