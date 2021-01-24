import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { ObjectHelper } from "@withonevision/omnihive-core/helpers/ObjectHelper";
import { ServerSettings } from "@withonevision/omnihive-core/models/ServerSettings";
import { CommonStore } from "@withonevision/omnihive-core/stores/CommonStore";
import { assert } from "chai";
import fs from "fs";
import { serializeError } from "serialize-error";
import NodeForgeEncryptionWorker from "..";
import packageJson from "../package.json";

const getConfig = function (): ServerSettings | undefined {
    try {
        if (!process.env.omnihive_test_worker_encryption_nodeforge) {
            return undefined;
        }

        const config: ServerSettings = ObjectHelper.create(
            ServerSettings,
            JSON.parse(
                fs.readFileSync(`${process.env.omnihive_test_worker_encryption_nodeforge}`, { encoding: "utf8" })
            )
        );

        if (!config.workers.some((worker) => worker.package === packageJson.name)) {
            return undefined;
        }

        return config;
    } catch {
        return undefined;
    }
};

let settings: ServerSettings;
let worker: NodeForgeEncryptionWorker = new NodeForgeEncryptionWorker();

describe("encryption worker tests", function () {
    before(function () {
        const config: ServerSettings | undefined = getConfig();

        if (!config) {
            this.skip();
        }

        CommonStore.getInstance().clearWorkers();
        settings = config;
    });

    const init = async function (): Promise<void> {
        try {
            await AwaitHelper.execute(CommonStore.getInstance().initWorkers(settings.workers));
            const newWorker = CommonStore.getInstance().workers.find((x) => x[0].package === packageJson.name);

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
            const result = worker.base64Encode("This will be an awesome test!!!");

            assert.equal(result, "VGhpcyB3aWxsIGJlIGFuIGF3ZXNvbWUgdGVzdCEhIQ==");
        });

        it("base64 - decrypt", function () {
            const result = worker.base64Decode("VGhpcyB3aWxsIGJlIGFuIGF3ZXNvbWUgdGVzdCEhIQ==");

            assert.equal(result, "This will be an awesome test!!!");
        });

        it("symmetric - encrypt", function () {
            const encryptString = "This will be an awesome test!!!";
            const encrypted = worker.symmetricEncrypt(encryptString);
            const result = worker.symmetricDecrypt(encrypted);

            assert.notEqual(encrypted, encryptString);
            assert.notEqual(encrypted, "VGhpcyB3aWxsIGJlIGFuIGF3ZXNvbWUgdGVzdCEhIQ==");
            assert.equal(result, encryptString);
        });

        it("symmetric - decrypt", function () {
            const result = worker.symmetricDecrypt(
                "D1gMYhmWRpZe8+hHrKHfeA==:1FGCTgzDE8XQLmBqFURcdpedrkCrk/5Mehg6oKq2CXc="
            );

            assert.equal(result, "This will be an awesome test!!!");
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
                worker.symmetricDecrypt(":1FGCTgzDE8XQLmBqFURcdpedrkCrk/5Mehg6oKq2CXc=");
                assert.fail("Expected a failure");
            } catch (err) {
                assert.equal(err.message, "Invalid IV length; got 0 bytes and expected 16 bytes.");
            }
        });

        it("symmetric - decrypt - invalid - data packet", function () {
            this.skip();

            try {
                worker.symmetricDecrypt("D1gMYhmWRpZe8+hHrKHfeA==:");
                assert.fail("Expected a failure");
            } catch (err) {
                assert.equal(err.message, "Secure message data packet not in the correct format");
            }
        });

        it("symmetric - decrypt - invalid - key", function () {
            this.skip();

            try {
                worker.config.metadata.encryptionKey = "Invalid Data Key Format";
                worker.init(worker.config);

                worker.symmetricDecrypt("D1gMYhmWRpZe8+hHrKHfeA==:1FGCTgzDE8XQLmBqFURcdpedrkCrk/5Mehg6oKq2CXc=");
                assert.fail("Expected a failure");
            } catch (err) {
                assert.equal(err.message, "Secure message symmetric key not in the correct format");
            }
        });
    });
});
