import { expect } from "chai";
import CacheRedisWorker from "..";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import faker from "faker";

class TestSetup {
    public cacheKey: string = faker.datatype.string();
    public cacheValue: string = faker.datatype.string();
    public connectionStringInvalid: string = "redis://localhost:9999";
    public connectionStringValid: string = "redis://localhost:6379";
    public timeout: number = 5000;
    public workerInvalid: CacheRedisWorker = new CacheRedisWorker();
    public workerValid: CacheRedisWorker = new CacheRedisWorker();
    public workerName: string = "testCacheRedisCacheWorker";
}

const testSetup: TestSetup = new TestSetup();

describe("Worker Test - Cache - Redis", () => {
    describe("Init Functions", () => {
        it("Test Init - Valid Connection String", async () => {
            await AwaitHelper.execute(
                testSetup.workerValid.init(testSetup.workerName, { connectionString: testSetup.connectionStringValid })
            );
        });

        it("Test Init - Invalid Connection String", async () => {
            try {
                await AwaitHelper.execute(
                    testSetup.workerInvalid.init(testSetup.workerName, {
                        connectionString: testSetup.connectionStringInvalid,
                    })
                );
                expect.fail("Method Expected to Fail");
            } catch (err) {
                expect(err).to.be.an.instanceOf(Error);
            }
        });
    });
    describe("Worker Functions", () => {
        beforeEach(async () => {
            const exists = await AwaitHelper.execute(testSetup.workerValid.exists(testSetup.cacheKey));
            if (exists) await AwaitHelper.execute(testSetup.workerValid.remove(testSetup.cacheKey));
        });

        it(`Key "${testSetup.cacheKey}" Does Not Exist`, async () => {
            const result = await AwaitHelper.execute(testSetup.workerValid.exists(testSetup.cacheKey));
            expect(result).to.be.false;
        });

        it(`Get/Set Cache Key "${testSetup.cacheKey}" With Value "${testSetup.cacheValue}"`, async () => {
            await AwaitHelper.execute(
                testSetup.workerValid.set(testSetup.cacheKey, testSetup.cacheValue, testSetup.timeout)
            );
            const result = await AwaitHelper.execute(testSetup.workerValid.get(testSetup.cacheKey));
            expect(result).to.equal(testSetup.cacheValue);
        });

        it(`Cache Value of ${testSetup.cacheKey} is Undefined`, async () => {
            const result = await AwaitHelper.execute(testSetup.workerValid.get(testSetup.cacheKey));
            expect(result).to.be.undefined;
        });

        it(`Delete Key ${testSetup.cacheKey}`, async () => {
            await AwaitHelper.execute(
                testSetup.workerValid.set(testSetup.cacheKey, testSetup.cacheValue, testSetup.timeout)
            );
            await AwaitHelper.execute(testSetup.workerValid.remove(testSetup.cacheKey));
            const result = await AwaitHelper.execute(testSetup.workerValid.exists(testSetup.cacheKey));
            expect(result).to.be.false;
        });
    });
});
