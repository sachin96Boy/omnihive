import { AwaitHelper } from '@withonevision/omnihive-hive-common/helpers/AwaitHelper';
import { HiveWorker } from '@withonevision/omnihive-hive-common/models/HiveWorker';
import { IPubSubServerWorker } from '@withonevision/omnihive-hive-worker/interfaces/IPubSubServerWorker';
import { HiveWorkerBase } from '@withonevision/omnihive-hive-worker/models/HiveWorkerBase';
import PusherServer from 'pusher';
import { serializeError } from 'serialize-error';


export class PusherPubSubServerWorkerMetadata {
    public appId: string = "";
    public key: string = "";
    public secret: string = "";
    public cluster: string = "";
}

export default class PusherPubSubServerWorker extends HiveWorkerBase implements IPubSubServerWorker {

    private server!: PusherServer;

    constructor() {
        super();
    }

    public async init(config: HiveWorker): Promise<void> {
        try {
            await AwaitHelper.execute<void>(super.init(config));
            const metadata: PusherPubSubServerWorkerMetadata = this.hiveWorkerHelper.checkMetadata<PusherPubSubServerWorkerMetadata>(PusherPubSubServerWorkerMetadata, config.metadata);
            this.server = new PusherServer({ appId: metadata.appId, key: metadata.key, secret: metadata.secret, cluster: metadata.cluster });
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    }

    public emit = async (channelName: string, eventName: string, data: any): Promise<void> => {
        try {
            this.server.trigger(channelName, eventName, data);
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    }

}