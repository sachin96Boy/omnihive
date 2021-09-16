import {
    AwaitHelper,
    HiveWorkerBase,
    IPubSubServerWorker,
    IsHelper,
    PubSubListener,
} from "@withonevision/omnihive-core";
import { Server, Socket } from "socket.io";

export class SocketIoPubSubServerWorkerMetadata {
    public port: number = 8080;
}

export default class SocketIoPubSubServerWorker extends HiveWorkerBase implements IPubSubServerWorker {
    private ioServer!: Server;
    private listeners: PubSubListener[] = [];

    constructor() {
        super();
    }

    public async init(name: string, metadata?: any): Promise<void> {
        await AwaitHelper.execute(super.init(name, metadata));
        const typedMetadata: SocketIoPubSubServerWorkerMetadata =
            this.checkObjectStructure<SocketIoPubSubServerWorkerMetadata>(SocketIoPubSubServerWorkerMetadata, metadata);

        this.ioServer = new Server();
        this.ioServer.listen(typedMetadata.port);

        this.ioServer.on("connection", (socket: Socket) => {
            socket.on("join-room", (room: string) => {
                socket.join(room);
            });

            socket.on("leave-room", (room: string) => {
                socket.leave(room);
            });
        });
    }

    public addListener = (channelName: string, eventName: string, callback?: Function): void => {
        this.removeListener(channelName, eventName);

        if (!this.listeners.some((listener: PubSubListener) => listener.eventName === eventName)) {
            this.ioServer.addListener(eventName, (packet: { room: string; data: any }) => {
                if (packet.room === channelName && callback && IsHelper.isFunction(callback)) {
                    callback(packet.data);
                }
            });
        }

        this.listeners.push({ channelName, eventName, callback });
    };

    public emit = async (channelName: string, eventName: string, message: any): Promise<void> => {
        this.ioServer.to(channelName).emit(eventName, { room: channelName, data: message });
    };

    public getListeners = (): PubSubListener[] => {
        return this.listeners;
    };

    public removeListener = (channelName: string, eventName: string): void => {
        if (
            this.listeners.some(
                (listener: PubSubListener) => listener.channelName == channelName && listener.eventName === eventName
            )
        ) {
            const listener: PubSubListener | undefined = this.listeners.find(
                (listener: PubSubListener) => listener.channelName == channelName && listener.eventName === eventName
            );

            this.listeners = this.listeners.filter(
                (listener: PubSubListener) => listener.channelName == channelName && listener.eventName !== eventName
            );

            if (!IsHelper.isNullOrUndefined(listener) && !IsHelper.isNullOrUndefined(listener.callback)) {
                this.ioServer.removeListener(eventName, listener.callback);
            }
        }
    };
}
