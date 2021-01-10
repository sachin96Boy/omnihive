import { AwaitHelper } from '@withonevision/omnihive-hive-common/helpers/AwaitHelper';
import { HiveWorker } from '@withonevision/omnihive-hive-common/models/HiveWorker';
import { ICacheWorker } from '@withonevision/omnihive-hive-worker/interfaces/ICacheWorker';
import { HiveWorkerBase } from '@withonevision/omnihive-hive-worker/models/HiveWorkerBase';
import Redis from 'ioredis';
import { serializeError } from 'serialize-error';

export class RedisCacheWorkerMetadata {
    public connectionString: string = "";
}

export default class RedisCacheWorker extends HiveWorkerBase implements ICacheWorker {

    private redis!: Redis.Redis;

    constructor() {
        super();
    }

    public async init(config: HiveWorker): Promise<void> {
        try {
            await AwaitHelper.execute<void>(super.init(config));
            const metadata: RedisCacheWorkerMetadata = this.checkMetadata<RedisCacheWorkerMetadata>(RedisCacheWorkerMetadata, config.metadata);
            this.redis = new Redis(metadata.connectionString);
        } catch (err) {
            throw new Error("Redis Init Error => " + JSON.stringify(serializeError(err)));
        }
    }

    public exists = async (key: string): Promise<boolean> => {
        return await AwaitHelper.execute<number>(this.redis.exists(key)) === 1;
    }

    public get = async (key: string): Promise<string | undefined> => {
        const value: string | null = await AwaitHelper.execute<string | null>(this.redis.get(key));

        if (!value) {
            return undefined;
        }

        return value;
    }

    public set = async (key: string, value: string, expireSeconds: number): Promise<boolean> => {
        this.redis.set(key, value, 'EX', expireSeconds);
        return true;
    }

    public remove = async (key: string): Promise<boolean> => {
        this.redis.del(key);
        return true;
    }
}