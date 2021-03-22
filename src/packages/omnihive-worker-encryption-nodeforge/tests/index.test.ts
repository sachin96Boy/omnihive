import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { assert } from "chai";
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
        before(async function () {
            await init();
        });

        it("base64 - encrypt", function () {
            const result = worker.base64Encode(testService.getConstants()["encryptionMessage"]);
            assert.equal(result, testService.getConstants()["base64Encrypted"]);
        });

        it("base64 - decrypt", function () {
            const result = worker.base64Decode(testService.getConstants()["base64Encrypted"]);
            assert.equal(result, testService.getConstants()["encryptionMessage"]);
        });

        it("symmetric - encrypt", function () {
            const encryptString = testService.getConstants()["encryptionMessage"];
            const encrypted = worker.symmetricEncrypt(encryptString);
            const result = worker.symmetricDecrypt(encrypted);

            assert.notEqual(encrypted, encryptString);
            assert.notEqual(encrypted, testService.getConstants()["symetricEncrypted"]);
            assert.equal(result, encryptString);
        });

        it("symmetric - decrypt", function () {
            const testString = testService.getConstants()["symetricEncrypted"];
            const result = worker.symmetricDecrypt(testString);
            assert.equal(result, testService.getConstants()["encryptionMessage"]);
        });

        it("symmetric - decrypt - invalid - format", function () {
            try {
                worker.symmetricDecrypt("invalid-format");
                assert.fail("Failed Test");
            } catch (err) {
                assert.equal(err.message, "Secure message data is not in the correct format");
            }
        });

        it("symmetric - decrypt - empty - iv", function () {
            try {
                worker.symmetricDecrypt(testService.getConstants()["encryptionInvalidIvLength"]);
                assert.fail("Failed Test");
            } catch (err) {
                assert.equal(err.message, "Secure message symmetric iv not in the correct format");
            }
        });

        it("symmetric - decrypt - invalid - iv", function () {
            try {
                worker.symmetricDecrypt(testService.getConstants()["encryptionInvalidIv"]);
                assert.fail("Failed Test");
            } catch (err) {
                assert.equal(err.message, "Secure message symmetric iv not in the correct format");
            }
        });

        it("symmetric - decrypt - invalid - data packet", function () {
            try {
                worker.symmetricDecrypt(testService.getConstants()["encryptionInvalidDataPacket"]);
                assert.fail("Failed Test");
            } catch (err) {
                assert.equal(err.message, "Secure message data packet not in the correct format");
            }
        });

        it("symmetric - decrypt - invalid - key", function () {
            try {
                worker.config.metadata.encryptionKey =
                    "Invalid Data Key Format that is too long. Invalid Data Key Format that is too long. Invalid Data Key Format that is too long.";
                worker.init(worker.config);

                worker.symmetricDecrypt(testService.getConstants()["symetricEncrypted"]);
                assert.fail("Failed Test");
            } catch (err) {
                assert.equal(err.message, "Secure message symmetric key not in the correct format");
            }
        });
    });
});
