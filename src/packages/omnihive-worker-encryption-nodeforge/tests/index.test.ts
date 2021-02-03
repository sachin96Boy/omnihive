import { NodeServiceFactory } from "@withonevision/omnihive-core-node/factories/NodeServiceFactory";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { TestConfigSettings } from "@withonevision/omnihive-core/models/TestConfigSettings";
import { assert } from "chai";
import { serializeError } from "serialize-error";
import NodeForgeEncryptionWorker from "..";
import packageJson from "../package.json";

let settings: TestConfigSettings;
let worker: NodeForgeEncryptionWorker = new NodeForgeEncryptionWorker();
const constants: { [key: string]: string }[] = NodeServiceFactory.testService.getConstants();

describe("encryption worker tests", function () {
    before(function () {
        const config: TestConfigSettings | undefined = NodeServiceFactory.testService.getTestConfig(packageJson.name);

        if (!config) {
            this.skip();
        }

        NodeServiceFactory.workerService.clearWorkers();
        settings = config;
    });

    const init = async function (): Promise<void> {
        try {
            await AwaitHelper.execute(NodeServiceFactory.workerService.initWorkers(settings.workers));
            const newWorker = NodeServiceFactory.workerService.registeredWorkers.find(
                (x) => x[0].package === packageJson.name
            );

            if (newWorker && newWorker[1]) {
                worker = newWorker[1];
            }
        } catch (err) {
            throw new Error("init failure: " + serializeError(JSON.stringify(err)));
        }
    };

    describe("Init functions", function () {
        it("test init", async function () {
            const result = await init();
            assert.isUndefined(result);
        });
    });

    describe("Worker Functions", function () {
        before(async function () {
            await init();
        });

        it("base64 - encrypt", function () {
            const result = worker.base64Encode(constants["encryptionDecrypted"]);
            assert.equal(result, constants["encryptionEncrypted"]);
        });

        it("base64 - decrypt", function () {
            const result = worker.base64Decode(constants["encryptionEncrypted"]);
            assert.equal(result, constants["encryptionDecrypted"]);
        });

        it("symmetric - encrypt", function () {
            const encryptString = constants["encryptionDecrypted"];
            const encrypted = worker.symmetricEncrypt(encryptString);
            const result = worker.symmetricDecrypt(encrypted);

            assert.notEqual(encrypted, encryptString);
            assert.notEqual(encrypted, constants["encryptionEncrypted"]);
            assert.equal(result, encryptString);
        });

        it("symmetric - decrypt", function () {
            const result = worker.symmetricDecrypt(constants["encryptionEncrypted"]);
            assert.equal(result, constants["encryptionDecrypted"]);
        });

        it("symmetric - decrypt - invalid - format", function () {
            try {
                worker.symmetricDecrypt("invalid-format");
                assert.fail("Expected a failure");
            } catch (err) {
                assert.equal(err.message, "Secure message data is not in the correct format");
            }
        });

        it("symmetric - decrypt - invalid - iv", function () {
            try {
                worker.symmetricDecrypt(constants["encryptionInvalidIv"]);
                assert.fail("Expected a failure");
            } catch (err) {
                assert.equal(err.message, "Invalid IV length; got 0 bytes and expected 16 bytes.");
            }
        });

        it("symmetric - decrypt - invalid - data packet", function () {
            try {
                worker.symmetricDecrypt(constants["encryptionInvalidDataPacket"]);
                assert.fail("Expected a failure");
            } catch (err) {
                assert.equal(err.message, "Secure message data packet not in the correct format");
            }
        });

        it("symmetric - decrypt - invalid - key", function () {
            try {
                worker.config.metadata.encryptionKey = "Invalid Data Key Format";
                worker.init(worker.config);

                worker.symmetricDecrypt(constants["encryptionInvalidKey"]);
                assert.fail("Expected a failure");
            } catch (err) {
                assert.equal(err.message, "Secure message symmetric key not in the correct format");
            }
        });
    });
});
