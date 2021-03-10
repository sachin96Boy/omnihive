import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { IPubSubServerWorker } from "@withonevision/omnihive-core/interfaces/IPubSubServerWorker";
import { HiveWorker } from "@withonevision/omnihive-core/models/HiveWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-core/models/HiveWorkerBase";
import * as socketio from "socket.io";

export class SocketIoPubSubServerWorkerMetadata {
    public port: number = 8080;
}

export default class SocketIoPubSubServerWorker extends HiveWorkerBase implements IPubSubServerWorker {
    private ioServer!: socketio.Server;

    constructor() {
        super();
    }

    public async init(config: HiveWorker): Promise<void> {
        await AwaitHelper.execute<void>(super.init(config));
        const metadata: SocketIoPubSubServerWorkerMetadata = this.checkObjectStructure<SocketIoPubSubServerWorkerMetadata>(
            SocketIoPubSubServerWorkerMetadata,
            this.config.metadata
        );

        this.ioServer = new socketio.Server();
        this.ioServer.listen(metadata.port);

        this.ioServer.on("connection", (socket: socketio.Socket) => {
            socket.on("join-room", (room: string) => {
                socket.join(room);
            });

            socket.on("leave-room", (room: string) => {
                socket.leave(room);
            });
        });
    }

    public emit = async (channelName: string, eventName: string, message: any): Promise<void> => {
        this.ioServer.to(channelName).emit(eventName, { room: channelName, data: message });
    };
}
