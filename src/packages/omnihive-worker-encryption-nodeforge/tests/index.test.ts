import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { assert } from "chai";
import { serializeError } from "serialize-error";
import NodeForgeEncryptionWorker from "..";
import { TestConfigSettings } from "../../../tests/models/TestConfigSettings";
import { TestService } from "../../../tests/services/TestService";
import packageJson from "../package.json";

let settings: TestConfigSettings;
let worker: NodeForgeEncryptionWorker = new NodeForgeEncryptionWorker();
const testService: TestService = new TestService();

describe("encryption worker tests", function () {
    before(function () {
        const config: TestConfigSettings | undefined = testService.getTestConfig(packageJson.name);

        if (!config) {
            this.skip();
        }

        testService.clearWorkers();
        settings = config;
    });

    const init = async function (): Promise<void> {
        try {
            await AwaitHelper.execute(testService.initWorkers(settings.workers));
            const newWorker: any = testService.registeredWorkers.find((x: any) => x[0].package === packageJson.name);

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
            const result = worker.base64Encode(testService.getConstants?.()?.["encryptionDecrypted"]);
            assert.equal(result, testService.getConstants?.()?.["encryptionEncrypted"]);
        });

        it("base64 - decrypt", function () {
            const result = worker.base64Decode(testService.getConstants?.()?.["encryptionEncrypted"]);
            assert.equal(result, testService.getConstants?.()?.["encryptionDecrypted"]);
        });

        it("symmetric - encrypt", function () {
            const encryptString = testService.getConstants?.()?.["encryptionDecrypted"];
            const encrypted = worker.symmetricEncrypt(encryptString);
            const result = worker.symmetricDecrypt(encrypted);

            assert.notEqual(encrypted, encryptString);
            assert.notEqual(encrypted, testService.getConstants?.()?.["encryptionEncrypted"]);
            assert.equal(result, encryptString);
        });

        it("symmetric - decrypt", function () {
            const result = worker.symmetricDecrypt(testService.getConstants?.()?.["encryptionEncrypted"]);
            assert.equal(result, testService.getConstants?.()?.["encryptionDecrypted"]);
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
                worker.symmetricDecrypt(testService.getConstants?.()?.["encryptionInvalidIv"]);
                assert.fail("Expected a failure");
            } catch (err) {
                assert.equal(err.message, "Invalid IV length; got 0 bytes and expected 16 bytes.");
            }
        });

        it("symmetric - decrypt - invalid - data packet", function () {
            try {
                worker.symmetricDecrypt(testService.getConstants?.()?.["encryptionInvalidDataPacket"]);
                assert.fail("Expected a failure");
            } catch (err) {
                assert.equal(err.message, "Secure message data packet not in the correct format");
            }
        });

        it("symmetric - decrypt - invalid - key", function () {
            try {
                worker.config.metadata.encryptionKey = "Invalid Data Key Format";
                worker.init(worker.config);

                worker.symmetricDecrypt(testService.getConstants?.()?.["encryptionInvalidKey"]);
                assert.fail("Expected a failure");
            } catch (err) {
                assert.equal(err.message, "Secure message symmetric key not in the correct format");
            }
        });
    });
});
