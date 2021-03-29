import { WorkerGetterBase } from "@withonevision/omnihive-core/models/WorkerGetterBase";
import { expect } from "chai";
import sinon from "sinon";
import { TestService } from "../../../tests/services/TestService";
import { TestConfigSettings } from "../../../tests/models/TestConfigSettings";
import objectHash from "object-hash";

import TokenWorker from "../../omnihive-worker-token-jsonwebtoken";
import SystemAccessTokenWorker from "../SystemAccessTokenWorker";

const worker = new SystemAccessTokenWorker();

const testService = new TestService();
const tokenWorker = new TokenWorker();
const {
    workers: [config],
} = <TestConfigSettings>testService.getTestConfig("@withonevision/omnihive-worker-token-jsonwebtoken");
tokenWorker.init(config);

describe("system access token worker tests", () => {
    afterEach(() => {
        sinon.restore();
    });
    describe("worker functions", () => {
        it("execute - no token worker", async () => {
            try {
                await worker.execute(undefined, "", undefined);
                throw new Error("Method expected to fail, but didn't");
            } catch (err) {
                expect(err).to.be.an("error").with.property("message", "Token Worker cannot be found");
            }
        });
        it("execute - no parameters", async () => {
            sinon.stub(tokenWorker, "get").resolves("mockToken");
            sinon.stub(WorkerGetterBase.prototype, "getWorker").returns(tokenWorker);
            const result = await worker.execute(undefined, "", undefined);
            expect(result.status).to.eq(400);
            expect(result.response).to.have.nested.property("error.message", "Request must have parameters");
        });
        it("execute - no match", async () => {
            sinon.stub(tokenWorker, "get").resolves("mockToken");
            sinon.stub(WorkerGetterBase.prototype, "getWorker").returns(tokenWorker);
            const result = await worker.execute(undefined, "", { generator: "mockGenerator" });
            expect(result.status).to.eq(400);
            expect(result.response).to.have.nested.property("error.message", "Token cannot be generated");
        });
        it("execute", async () => {
            sinon.stub(tokenWorker, "get").resolves("mockToken");
            sinon.stub(WorkerGetterBase.prototype, "getWorker").returns(tokenWorker);
            const result = await worker.execute(undefined, "", {
                generator: objectHash(config.metadata, { algorithm: config.metadata.hashAlgorithm }),
            });
            expect(result.status).to.eq(200);
            expect(result.response).to.be.an("object").with.property("token", "mockToken");
        });
        it("getSwaggerDefinition", () => {
            const result = worker.getSwaggerDefinition();
            expect(result?.definitions).to.be.an("object");
            expect(result?.paths).to.be.an("object");
        });
    });
});
