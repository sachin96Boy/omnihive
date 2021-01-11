import NodeForgeEncryptionWorker from '..';
import { assert } from 'chai';
import fs from 'fs';
import { serializeError } from 'serialize-error';
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import { HiveWorkerType } from "@withonevision/omnihive-hive-queen/enums/HiveWorkerType";
import { AwaitHelper } from "@withonevision/omnihive-hive-queen/helpers/AwaitHelper";
import { QueenStore } from "@withonevision/omnihive-hive-queen/stores/QueenStore";

const getConfigs = function (): any | undefined {
    try {
        if (!process.env.OH_ENV_FILE) {
            return undefined;
        }

        dotenvExpand(dotenv.config({ path: process.env.OH_ENV_FILE }));

        return JSON.parse(fs.readFileSync(`${process.env.OH_TEST_WORKER_ENCRYPTION_NODEFORGE}`,
            { encoding: "utf8" }));
    } catch {
        return undefined;
    }
}


let worker: NodeForgeEncryptionWorker = new NodeForgeEncryptionWorker();
let configs: any | undefined;

describe('encryption worker tests', function () {

    before(function () {
        configs = getConfigs();

        if (!configs) {
            this.skip();
        }
    });

    const init = async function (): Promise<void> {
        try {
            await AwaitHelper.execute(QueenStore.getInstance()
                .initWorkers(configs));
            const newWorker = QueenStore
                .getInstance()
                .workers
                .find((x) => x[0].type === HiveWorkerType.Encryption);

            if (newWorker && newWorker[1]) {
                worker = newWorker[1];
            }
        } catch (err) {
            throw new Error("init failure: " + serializeError(JSON.stringify(err)));
        }
    }

    describe("Init functions", function () {
        it('test init', async function () {
            const result = await init();
            assert.isUndefined(result);
        });
    });


    describe("Worker Functions", function () {
        before(async function () {
            await init();
        });

        it("base64 - encrypt", function() {
            const result = worker.base64Encode("This will be an awesome test!!!");

            assert.equal(result, "VGhpcyB3aWxsIGJlIGFuIGF3ZXNvbWUgdGVzdCEhIQ==");
        });

        it("base64 - decrypt", function() {
            const result = worker.base64Decode("VGhpcyB3aWxsIGJlIGFuIGF3ZXNvbWUgdGVzdCEhIQ==");

            assert.equal(result, "This will be an awesome test!!!");
        });

        it("symmetric - encrypt", function() {
            const encryptString = "This will be an awesome test!!!";
            const encrypted = worker.symmetricEncrypt(encryptString);
            const result = worker.symmetricDecrypt(encrypted);

            assert.notEqual(encrypted, encryptString);
            assert.notEqual(encrypted, "VGhpcyB3aWxsIGJlIGFuIGF3ZXNvbWUgdGVzdCEhIQ==");
            assert.equal(result, encryptString);
        });

        it("symmetric - decrypt", function() {
            const result = worker.symmetricDecrypt("D1gMYhmWRpZe8+hHrKHfeA==:1FGCTgzDE8XQLmBqFURcdpedrkCrk/5Mehg6oKq2CXc=");

            assert.equal(result, "This will be an awesome test!!!");
        });

        it("symmetric - decrypt - invalid - format", function() {
            try {
                worker.symmetricDecrypt("invalid-format");
                assert.fail("Expected a failure");
            } catch (err) {
                assert.equal(err.message, "Secure message data is not in the correct format");
            }
        });

        it("symmetric - decrypt - invalid - iv", function() {
            try {
                worker.symmetricDecrypt(":1FGCTgzDE8XQLmBqFURcdpedrkCrk/5Mehg6oKq2CXc=");
                assert.fail("Expected a failure");
            } catch (err) {
                assert.equal(err.message, "Invalid IV length; got 0 bytes and expected 16 bytes.");
            }
        });

        it("symmetric - decrypt - invalid - data packet", function() {
            this.skip();

            try {
                worker.symmetricDecrypt("D1gMYhmWRpZe8+hHrKHfeA==:");
                assert.fail("Expected a failure");
            } catch (err) {
                assert.equal(err.message, "Secure message data packet not in the correct format");
            }
        });


        it("symmetric - decrypt - invalid - key", function() {
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
})