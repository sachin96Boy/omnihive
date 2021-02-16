import { IGraphEndpointWorker } from "@withonevision/omnihive-core/interfaces/IGraphEndpointWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-core/models/HiveWorkerBase";
import { serializeError } from "serialize-error";
import { WatchContent } from "../../lib/models/WatchModels";
import { getMessageById } from "../common/GetMessaegById";

class GetMessageByIdArguemnts {
    id: number = 0;
}

export default class GetMessageById extends HiveWorkerBase implements IGraphEndpointWorker {
    public execute = async (customArgs: any): Promise<WatchContent | {}> => {
        const args: GetMessageByIdArguemnts = this.checkObjectStructure<GetMessageByIdArguemnts>(
            GetMessageByIdArguemnts,
            customArgs
        );

        if (!args.id) {
            throw new Error("A Message Id is required");
        }

        try {
            const latestMessage = await getMessageById(args.id);

            if (latestMessage) {
                return latestMessage;
            }

            return {};
        } catch (err) {
            console.log(JSON.stringify(serializeError(err)));
            return {};
        }
    };
}
