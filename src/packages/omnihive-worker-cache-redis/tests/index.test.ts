import { expect } from "chai";
import CacheRedisWorker from "..";
import { TestConfigSettings } from "../../../tests/models/TestConfigSettings";
import { TestService } from "../../../tests/services/TestService";
import packageJson from "../package.json";
import sinon from "sinon";
import ioredis from "ioredis";

const testService = new TestService();
const {
    workers: [config],
} = <TestConfigSettings>testService.getTestConfig(packageJson.name);
const worker = new CacheRedisWorker();

describe("cache (redis) worker tests", () => {
    afterEach(() => {
        sinon.restore();
    });
    describe("init functions", () => {
        it("test init", async () => {
            const stubConnect = sinon.stub(ioredis.prototype, "connect").returns(Promise.resolve());
            await worker.init(config);
            expect(stubConnect.calledOnce).to.be.true;
            expect(worker.config).to.be.an("object");
        });
        it("test init - invalid connection string", async () => {
            const stubConnect = sinon.stub(ioredis.prototype, "connect").throws();
            try {
                await worker.init(config);
                throw new Error("Method expected to fail, but didn't");
            } catch (err) {
                expect(err).to.be.an("error");
            }
            expect(stubConnect.calledOnce).to.be.true;
        });
    });
    describe("worker functions", () => {
        it("does not exist", async () => {
            const stubRedisExists = sinon.stub(ioredis.prototype, "exists").returns(Promise.resolve(1));
            const exists = await worker.exists("ping");
            expect(exists).to.be.true;
            expect(stubRedisExists.calledOnce).to.be.true;
            stubRedisExists.reset();
        });
        it("set/get cache", async () => {
            const stubSet = sinon.stub(ioredis.prototype, "set");
            const stubGet = sinon.stub(ioredis.prototype, "get").returns(Promise.resolve("pong"));
            await worker.set("ping", "pong", 5000);
            const result = await worker.get("ping");
            expect(stubSet.calledOnce).to.be.true;
            expect(stubGet.calledOnce).to.be.true;
            expect(result).to.eq("pong");
        });
        it("get nonexistent cache", async () => {
            const stubGet = sinon.stub(ioredis.prototype, "get").returns(Promise.resolve(null));
            const result = await worker.get("ping");
            expect(stubGet.calledOnce).to.be.true;
            expect(result).to.eq(undefined);
        });
        it("delete cache", async () => {
            const stubDel = sinon.stub(ioredis.prototype, "del").returns(Promise.resolve());
            const result = await worker.remove("ping");
            expect(stubDel.calledOnce).to.be.true;
            expect(result).to.be.true;
        });
    });
});
