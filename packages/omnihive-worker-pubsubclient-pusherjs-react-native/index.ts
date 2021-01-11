
import { AwaitHelper } from "@withonevision/omnihive-hive-queen/helpers/AwaitHelper";
import { IPubSubClientWorker } from "@withonevision/omnihive-hive-queen/interfaces/IPubSubClientWorker";
import { HiveWorker } from "@withonevision/omnihive-hive-queen/models/HiveWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-hive-queen/models/HiveWorkerBase";
import { PubSubListener } from "@withonevision/omnihive-hive-queen/models/PubSubListener";
import Pusher, { Channel } from "pusher-js/react-native";

export class PusherJsReactNativePubSubClientWorkerMetadata {
    public key: string = "";
    public cluster: string = "";
}

export default class PusherJsReactNativePubSubClientWorker extends HiveWorkerBase implements IPubSubClientWorker {

    private connected: boolean = false;
    private pusher!: Pusher;
    private listeners: PubSubListener[] = [];
    private channels: Channel[] = [];
    private metadata!: PusherJsReactNativePubSubClientWorkerMetadata;

    constructor() {
        super();
    }

    public async init(config: HiveWorker): Promise<void> {
        await AwaitHelper.execute<void>(super.init(config));
        this.metadata = this.checkMetadata<PusherJsReactNativePubSubClientWorkerMetadata>(PusherJsReactNativePubSubClientWorkerMetadata, this.config.metadata);
        await AwaitHelper.execute<void>(this.connect());
    }

    public getListeners = (): PubSubListener[] => {
        return this.listeners;
    }

    public getJoinedChannels = (): string[] => {
        const channelNames: string[] = [];

        this.channels.forEach((channel: Channel) => {
            channelNames.push(channel.name);
        });

        return channelNames;
    }

    public addListener = (channelName: string, eventName: string, callback?: Function): void => {
        this.checkConnection();

        if (!this.channels.some((channel: Channel) => channel.name === channelName)) {
            this.joinChannel(channelName);
        }

        this.removeListener(channelName, eventName);

        this.channels.filter((channel: Channel) => channel.name === channelName)[0].bind(eventName, (data: any) => {
            if (callback && typeof (callback) === 'function') {
                callback(data);
            }
        });

        this.listeners.push({ channelName, eventName, callback });
    }

    public removeListener = (channelName: string, eventName: string): void => {
        this.checkConnection();

        if (this.listeners.some((listener: PubSubListener) => listener.channelName == channelName && listener.eventName === eventName)) {
            this.listeners = this.listeners.filter((listener: PubSubListener) => listener.channelName == channelName && listener.eventName !== eventName);
            this.channels.filter((channel: Channel) => channel.name === channelName)[0].unbind(eventName);
        }
    }

    public connect = async (): Promise<void> => {
        this.pusher = new Pusher(this.metadata.key, { cluster: this.metadata.cluster });
        this.connected = true;
    }

    public disconnect = (): void => {

        if (!this.pusher) {
            throw new Error("Pusher is not instantiated.")
        }

        this.checkConnection();

        this.listeners.filter((listener: PubSubListener) => {
            this.removeListener(listener.channelName, listener.eventName);
        });

        this.listeners = [];

        this.getJoinedChannels().forEach((channel: string) => {
            this.leaveChannel(channel);
        });

        this.channels = [];

        this.pusher.disconnect();
        this.connected = false;
    }

    public joinChannel = (channelName: string): void => {

        if (!this.pusher) {
            throw new Error("Pusher is not instantiated.")
        }

        this.checkConnection();

        if (!this.channels.some((channel: Channel) => channel.name === channelName)) {
            this.channels.push(this.pusher.subscribe(channelName));
        }

    }

    public leaveChannel = (channelName: string): void => {

        if (!this.pusher) {
            throw new Error("Pusher is not instantiated.")
        }

        this.checkConnection();

        if (this.channels.some((channel: Channel) => channel.name === channelName)) {
            this.channels.filter((channel: Channel) => channel.name === channelName)[0].unbind_all();
            this.channels = this.channels.filter((channel: Channel) => channel.name !== channelName);
            this.pusher.unsubscribe(channelName);
        }
    }

    private checkConnection = (): boolean => {
        if (!this.connected) {
            throw new Error("Please call 'connect' before performing any pubsub actions")
        } else {
            return true;
        }
    }
}