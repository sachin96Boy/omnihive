import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { assert } from "chai";
import { serializeError } from "serialize-error";
import RedisCacheWorker from "..";
import { TestConfigSettings } from "../../../tests/models/TestConfigSettings";
import { TestService } from "../../../tests/services/TestService";
import packageJson from "../package.json";

let settings: TestConfigSettings;
let worker: RedisCacheWorker = new RedisCacheWorker();
const testService: TestService = new TestService();

describe("cache (redis) worker tests", function () {
    before(function () {
        const config: TestConfigSettings | undefined = testService.getTestConfig(packageJson.name);

        if (!config) {
            this.skip();
        }

        testService.clearWorkers();
        settings = config;
    });

    const init = async function (): Promise<void> {
        await AwaitHelper.execute(testService.initWorkers(settings.workers));
        const newWorker: any = testService.registeredWorkers.find((x: any) => x.package === packageJson.name);

        if (newWorker && newWorker.instance) {
            worker = newWorker.instance;
        }
    };

    describe("Init functions", function () {
        it("test init", async function () {
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
        };

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
            } catch (err) {
                ``;
                throw new Error("Get Non-Existant Cache Error => " + JSON.stringify(serializeError(err)));
            }
        });

        it("remove cache", async function () {
            const cacheSet = await AwaitHelper.execute<boolean>(setCacheFile());

            if (cacheSet) {
                const result = await AwaitHelper.execute<boolean>(worker.remove(cacheKey));

                assert.isTrue(result);
            } else {
                throw new Error("Remove Cache Error => Failed to set cache");
            }
        });
    });
});
