import { WorkerGetterBase } from "@withonevision/omnihive-core/models/WorkerGetterBase";
import { expect } from "chai";
import sinon from "sinon";
import { TestService } from "../../../tests/services/TestService";
import { TestConfigSettings } from "../../../tests/models/TestConfigSettings";

import TokenWorker from "../../omnihive-worker-token-jsonwebtoken";
import SystemStatusWorker from "../SystemStatusWorker";
import { ServerStatus } from "@withonevision/omnihive-core/enums/ServerStatus";

const worker = new SystemStatusWorker();
worker.serverSettings = {
    constants: {},
    features: {},
    workers: [],
    config: {
        adminPassword: "correctPassword",
        adminPortNumber: 9999,
        nodePortNumber: 9999,
        webRootUrl: "http://mock.example.com",
    },
};

const testService = new TestService();
const tokenWorker = new TokenWorker();
const {
    workers: [config],
} = <TestConfigSettings>testService.getTestConfig("@withonevision/omnihive-worker-token-jsonwebtoken");
tokenWorker.init(config);

describe("system access token worker tests", () => {
    before(() => {
        global.omnihive = {
            adminServer: undefined!,
            adminServerTimer: undefined!,
            appServer: undefined!,
            getWorker: undefined!,
            initWorkers: undefined!,
            instanceName: undefined!,
            ohDirName: undefined!,
            pushWorker: undefined!,
            registeredSchemas: undefined!,
            registeredWorkers: undefined!,
            registeredUrls: undefined!,
            serverError: undefined!,
            serverStatus: ServerStatus.Online!,
            serverSettings: undefined!,
            webServer: undefined!,
        };
    });
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
        it("execute - no headers", async () => {
            sinon.stub(WorkerGetterBase.prototype, "getWorker").returns(tokenWorker);
            const result = await worker.execute(undefined, "", undefined);
            expect(result.status).to.eq(400);
            expect(result.response).to.have.nested.property("error.message", "Request Denied");
        });
        it("execute - no body", async () => {
            sinon.stub(WorkerGetterBase.prototype, "getWorker").returns(tokenWorker);
            const result = await worker.execute({ ohAccess: "mockToken" }, "", undefined);
            expect(result.status).to.eq(400);
            expect(result.response).to.have.nested.property("error.message", "Request Denied");
        });
        it("execute - no ohAccess token", async () => {
            sinon.stub(WorkerGetterBase.prototype, "getWorker").returns(tokenWorker);
            const result = await worker.execute({ mockHeader: "mockValue" }, "", {});
            expect(result.status).to.eq(400);
            expect(result.response).to.have.nested.property("error.message", "[ohAccessError] Token Invalid");
        });
        it("execute - no admin password", async () => {
            sinon.stub(WorkerGetterBase.prototype, "getWorker").returns(tokenWorker);
            const result = await worker.execute({ ohAccess: "mockToken" }, "", {});
            expect(result.status).to.eq(400);
            expect(result.response).to.have.nested.property("error.message", "Request Denied");
        });
        it("execute - incorrect admin password", async () => {
            sinon.stub(WorkerGetterBase.prototype, "getWorker").returns(tokenWorker);
            sinon.stub(worker, "checkObjectStructure").returns({ adminPassword: "mockPassword" });
            const result = await worker.execute({ ohAccess: "mockToken" }, "", { adminPassword: "mockPassword" });
            expect(result.status).to.eq(400);
            expect(result.response).to.have.nested.property("error.message", "Request Denied");
        });
        it("execute", async () => {
            sinon.stub(WorkerGetterBase.prototype, "getWorker").returns(tokenWorker);
            sinon.stub(worker, "checkObjectStructure").returns({ adminPassword: "correctPassword" });
            const result = await worker.execute({ ohAccess: "mockToken" }, "", { adminPassword: "correctPassword" });
            expect(result.status).to.eq(200);
            expect(result.response).to.have.property("status", ServerStatus.Online);
            expect(result.response).to.have.property("error", undefined);
        });
        it("getSwaggerDefinition", () => {
            const result = worker.getSwaggerDefinition();
            expect(result?.definitions).to.be.an("object");
            expect(result?.paths).to.be.an("object");
        });
    });
});
