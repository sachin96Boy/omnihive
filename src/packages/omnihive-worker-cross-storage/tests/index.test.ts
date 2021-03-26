import { expect } from "chai";
import CrossStorageWorker from "..";
import { TestConfigSettings } from "../../../tests/models/TestConfigSettings";
import { TestService } from "../../../tests/services/TestService";
import packageJson from "../package.json";
import "jsdom-global/register";
import { WorkerGetterBase } from "@withonevision/omnihive-core/models/WorkerGetterBase";
import sinon from "sinon";
import { CrossStorageClient } from "cross-storage";

import EncryptionWorker from "../../omnihive-worker-encryption-nodeforge";

const testService = new TestService();
const {
    workers: [config],
} = <TestConfigSettings>testService.getTestConfig(packageJson.name);
const worker = new CrossStorageWorker();
const uninitializedWorker = new CrossStorageWorker();

describe("cross storage worker tests", () => {
    afterEach(() => {
        sinon.restore();
    });
    describe("init functions", () => {
        it("test init", async () => {
            await worker.init(config);
            expect(worker.config).to.be.an("object");
        });
    });
    describe("worker functions", () => {
        it("exists - not initialized", async () => {
            try {
                await uninitializedWorker.exists("ping");
                throw new Error("Method expected to fail, but didn't");
            } catch (err) {
                expect(err)
                    .to.be.an("error")
                    .with.property("message", "Client store has not been initialized.  Please call initialize first");
            }
        });
        it("exists - no encryption worker", async () => {
            try {
                await worker.exists("ping");
                throw new Error("Method expected to fail, but didn't");
            } catch (err) {
                expect(err)
                    .to.be.an("error")
                    .with.property(
                        "message",
                        "Encryption Worker Not Defined.  Cross-Storage Will Not Function Without Encryption Worker."
                    );
            }
        });
        it("does not exist", async () => {
            sinon.stub(WorkerGetterBase.prototype, "getWorker").returns(new EncryptionWorker());
            sinon.stub(CrossStorageClient.prototype, "onConnect").resolves();
            const exists = await worker.exists("ping");
            expect(exists).to.be.false;
        });
        it("exists", async () => {
            sinon.stub(WorkerGetterBase.prototype, "getWorker").returns(new EncryptionWorker());
            sinon.stub(CrossStorageClient.prototype, "onConnect").resolves();
            sinon.stub(CrossStorageClient.prototype, "get").resolves(["pong"]);
            const exists = await worker.exists("ping");
            expect(exists).to.be.true;
        });
        it("get - not initialized", async () => {
            try {
                await uninitializedWorker.get("ping");
                throw new Error("Method expected to fail, but didn't");
            } catch (err) {
                expect(err)
                    .to.be.an("error")
                    .with.property("message", "Client store has not been initialized.  Please call initialize first");
            }
        });
        it("get - no encryption worker", async () => {
            try {
                await worker.get("ping");
                throw new Error("Method expected to fail, but didn't");
            } catch (err) {
                expect(err)
                    .to.be.an("error")
                    .with.property(
                        "message",
                        "Encryption Worker Not Defined.  Cross-Storage Will Not Function Without Encryption Worker."
                    );
            }
        });
    });
});
