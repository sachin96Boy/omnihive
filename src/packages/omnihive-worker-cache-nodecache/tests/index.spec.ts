import { AwaitHelper } from "src/packages/omnihive-core/helpers/AwaitHelper";
import CacheNodeCacheWorker from "..";
import faker from "faker";
import { expect } from "chai";

class TestSetup {
    public cacheKey: string = faker.datatype.string();
    public cacheValue: string = faker.datatype.string();
    public timeout: number = 5000;
    public worker: CacheNodeCacheWorker = new CacheNodeCacheWorker();
    public workerName: string = "testCacheNodeCacheWorker";
}

const testSetup: TestSetup = new TestSetup();

describe("Worker Test - Cache - NodeCache", () => {
    describe("Init Functions", () => {
        it("Test Init", async () => {
            await AwaitHelper.execute(testSetup.worker.init(testSetup.workerName));
        });
    });

    describe("Worker Functions", () => {
        beforeEach(async () => {
            const exists = await AwaitHelper.execute(testSetup.worker.exists(testSetup.cacheKey));
            if (exists) await AwaitHelper.execute(testSetup.worker.remove(testSetup.cacheKey));
        });

        it(`Key "${testSetup.cacheKey}" Does Not Exist`, async () => {
            const result = await AwaitHelper.execute(testSetup.worker.exists(testSetup.cacheKey));
            expect(result).to.be.false;
        });

        it(`Get/Set Cache Key "${testSetup.cacheKey}" With Value "${testSetup.cacheValue}"`, async () => {
            await AwaitHelper.execute(
                testSetup.worker.set(testSetup.cacheKey, testSetup.cacheValue, testSetup.timeout)
            );
            const result = await AwaitHelper.execute(testSetup.worker.get(testSetup.cacheKey));
            expect(result).to.equal(testSetup.cacheValue);
        });

        it(`Cache Value of ${testSetup.cacheKey} is Undefined`, async () => {
            const result = await AwaitHelper.execute(testSetup.worker.get(testSetup.cacheKey));
            expect(result).to.be.undefined;
        });

        it(`Delete Key ${testSetup.cacheKey}`, async () => {
            await AwaitHelper.execute(
                testSetup.worker.set(testSetup.cacheKey, testSetup.cacheValue, testSetup.timeout)
            );
            await AwaitHelper.execute(testSetup.worker.remove(testSetup.cacheKey));
            const result = await AwaitHelper.execute(testSetup.worker.exists(testSetup.cacheKey));
            expect(result).to.be.false;
        });
    });
});
