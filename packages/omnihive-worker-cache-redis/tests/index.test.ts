import RedisCacheWorker from '..';
import { assert } from 'chai';
import fs from 'fs';
import { serializeError } from 'serialize-error';
import { HiveWorkerType } from "@withonevision/omnihive-common/enums/HiveWorkerType";
import { AwaitHelper } from "@withonevision/omnihive-common/helpers/AwaitHelper";
import { CommonStore } from "@withonevision/omnihive-common/stores/CommonStore";
import { ObjectHelper } from "@withonevision/omnihive-common/helpers/ObjectHelper";
import { ServerSettings } from "@withonevision/omnihive-common/models/ServerSettings";

const getConfig = function (): ServerSettings | undefined {
    try {
        if (!process.env.OH_SETTINGS_FILE) {
            return undefined;
        }

        return ObjectHelper.createStrict(ServerSettings, JSON.parse(
            fs.readFileSync(`${process.env.OH_SETTINGS_FILE}`,
                { encoding: "utf8" })));
    } catch {
        return undefined;
    }
}

let settings: ServerSettings;
let worker: RedisCacheWorker = new RedisCacheWorker();

describe('cache (redis) worker tests', function () {

    before(function () {
        const config: ServerSettings | undefined = getConfig();

        if (!config) {
            this.skip();
        }

        CommonStore.getInstance().clearWorkers();
        settings = config;
    });

    const init = async function (): Promise<void> {
        try {
            await AwaitHelper.execute(CommonStore.getInstance()
                .initWorkers(settings.workers));
            const newWorker = CommonStore
                .getInstance()
                .workers
                .find((x) => x[0].type === HiveWorkerType.Cache);

            if (newWorker && newWorker[1]) {
                worker = newWorker[1];
            }
        } catch (err) {
            throw new Error("init failure: " + serializeError(JSON.stringify(err)));
        }
    }

    describe("Init functions", function () {
        it('test init', async function () {
            const result = await init();
            assert.isUndefined(result);
        });
    });


    describe("Worker Functions", function () {
        const cacheKey: string = "mocha cache test";
        const cacheValue: string = "Test caching value";
        const cacheTimeout: number = 5000;

        before(async function () {
            await init();
        });

        beforeEach(async function () {
            const exists = await AwaitHelper.execute<boolean>(worker.exists(cacheKey));

            if (exists) {
                await AwaitHelper.execute<boolean>(worker.remove(cacheKey));
            }
        });

        const setCacheFile = async function (): Promise<boolean> {
            try {
                const exists = await AwaitHelper.execute<boolean>(worker.exists(cacheKey));

                if (exists) {
                    await AwaitHelper.execute<boolean>(worker.remove(cacheKey));
                }

                return await AwaitHelper.execute<boolean>(worker.set(cacheKey, cacheValue, cacheTimeout));
            } catch (err) {
                throw new Error("Set Cache File Error => " + JSON.stringify(serializeError(err)));
            }
        }

        it("does not exist", async function () {
            try {
                const result = await AwaitHelper.execute<boolean>(worker.exists(cacheKey));
                assert.isFalse(result);
            } catch (err) {
                throw new Error("Does Not Exist Error => " + JSON.stringify(serializeError(err)));
            }
        });

        it("set cache", async function () {
            try {
                await AwaitHelper.execute<boolean>(setCacheFile());
                const getValue = await AwaitHelper.execute<string | undefined>(worker.get(cacheKey));

                assert.equal(getValue, cacheValue);
            } catch (err) {
                throw new Error("Set Cache Error => " + JSON.stringify(serializeError(err)));
            }
        });

        it("does exist", async function () {
            const setComplete = await AwaitHelper.execute<boolean>(setCacheFile());

            if (setComplete) {
                try {
                    const exists = await AwaitHelper.execute<boolean>(worker.exists(cacheKey));
                    assert.isTrue(exists);
                } catch (err) {
                    throw new Error("Does Exist Error => " + JSON.stringify(serializeError(err)));
                }
            } else {
                assert.fail("Does Exist Error => Failed to set cache.");
            }
        });

        it("get cache", async function () {
            const cacheSet = await AwaitHelper.execute<boolean>(setCacheFile());

            if (cacheSet) {
                try {
                    const results = await AwaitHelper.execute<string | undefined>(worker.get(cacheKey));
                    assert.equal(results, cacheValue);
                } catch (err) {
                    throw new Error("Get Cache Error => " + JSON.stringify(serializeError(err)));
                }
            } else {
                throw new Error("Get Cache Error => Failed to set cache.");
            }
        });

        it("get non-existant cache", async function () {
            try {
                const result = await AwaitHelper.execute<string | undefined>(worker.get("Missing Cache Key"));
                assert.isUndefined(result);
            } catch (err){``
                throw new Error("Get Non-Existant Cache Error => " + JSON.stringify(serializeError(err)));
            }
        })

        it("remove cache", async function () {
            const cacheSet = await AwaitHelper.execute<boolean>(setCacheFile());

            if (cacheSet) {
                const result = await AwaitHelper.execute<boolean>(worker.remove(cacheKey));

                assert.isTrue(result);
            } else {
                throw new Error("Remove Cache Error => Failed to set cache");
            }
        })
    });
})