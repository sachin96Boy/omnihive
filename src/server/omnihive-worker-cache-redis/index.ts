import Redis from "ioredis";
import { HiveWorkerBase } from "@withonevision/omnihive-core/models/HiveWorkerBase";
import { ICacheWorker } from "@withonevision/omnihive-core/interfaces/ICacheWorker";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { IsHelper } from "@withonevision/omnihive-core/helpers/IsHelper";

export class RedisCacheWorkerMetadata {
    public connectionString: string = "";
}

export default class RedisCacheWorker extends HiveWorkerBase implements ICacheWorker {
    private redis!: Redis.Redis;

    constructor() {
        super();
    }

    public async init(name: string, metadata?: any): Promise<void> {
        await AwaitHelper.execute(super.init(name, metadata));
        const typedMetadata: RedisCacheWorkerMetadata = this.checkObjectStructure<RedisCacheWorkerMetadata>(
            RedisCacheWorkerMetadata,
            metadata
        );
        this.redis = new Redis(typedMetadata.connectionString);

        this.redis.on("error", () => {
            this.redis.disconnect();
        });
    }

    public exists = async (key: string): Promise<boolean> => {
        return (await AwaitHelper.execute(this.redis.exists(key))) === 1;
    };

    public get = async (key: string): Promise<string | undefined> => {
        const value: string | null = await AwaitHelper.execute(this.redis.get(key));

        if (IsHelper.isNullOrUndefined(value)) {
            return undefined;
        }

        return value;
    };

    public set = async (key: string, value: string, expireSeconds: number): Promise<boolean> => {
        this.redis.set(key, value, "EX", expireSeconds);
        return true;
    };

    public remove = async (key: string): Promise<boolean> => {
        this.redis.del(key);
        return true;
    };
}
