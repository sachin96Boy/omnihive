import AuthZeroTokenWorker from '..';
import { assert } from 'chai';
import fs from 'fs';
import { serializeError } from 'serialize-error';
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import { HiveWorkerType } from "@withonevision/omnihive-queen/enums/HiveWorkerType";
import { AwaitHelper } from "@withonevision/omnihive-queen/helpers/AwaitHelper";
import { QueenStore } from "@withonevision/omnihive-queen/stores/QueenStore";

const getConfigs = function (): any | undefined {
    try {
        if (!process.env.OH_ENV_FILE) {
            return undefined;
        }

        dotenvExpand(dotenv.config({ path: process.env.OH_ENV_FILE }));

        return JSON.parse(fs.readFileSync(`${process.env.OH_TEST_WORKER_TOKEN_AUTH0}`,
            { encoding: "utf8" }));
    } catch {
        return undefined;
    }
}


describe('token worker tests', function () {
    let configs: any | undefined;
    let worker: AuthZeroTokenWorker = new AuthZeroTokenWorker();
    let token: string = "";

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
                .find((x) => x[0].type === HiveWorkerType.Token);

            if (newWorker && newWorker[1]) {
                worker = newWorker[1];
            }
        } catch (err) {
            throw new Error("init error: " + JSON.stringify(serializeError(err)));
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

        const verifyStartState = async function (): Promise<void> {
            if (token && token.length > 0) {
                try {
                    const check = await worker.expired(token);

                    if (!check) {
                        token = await AwaitHelper.execute<string>(worker.get());
                    } else {
                        const verified = await AwaitHelper.execute<boolean>(worker.verify(token));

                        if (!verified) {
                            token = await AwaitHelper.execute<string>(worker.get());
                        }
                    }
                } catch (_err) {
                    token = await AwaitHelper.execute<string>(worker.get());
                }
            } else {
                token = await AwaitHelper.execute<string>(worker.get());
            }
        }

        it("Get Token", async function () {
            try {
                token = await AwaitHelper.execute<string>(
                    worker.get()
                );

                assert.isTrue(token && token.length > 0);
            } catch (err) {
                throw new Error("get token error: " + JSON.stringify(serializeError(err)));
            }
        });

        it("Get Token - after token is retrieved", async function () {
            try {
                await AwaitHelper.execute<string>(worker.get());
                token = await AwaitHelper.execute<string>(
                    worker.get()
                );

                assert.isTrue(token && token.length > 0);
            } catch (err) {
                throw new Error("get token error: " + JSON.stringify(serializeError(err)));
            }
        });

        it("Check Expired Token - Valid Token", async function () {
            try {
                await verifyStartState();
                const expired = await worker.expired(token);

                assert.isTrue(expired);
            } catch (err) {
                throw new Error("check expired token error: " + JSON.stringify(serializeError(err)));
            }
        });

        it("Check Expired Token - Expired Token", async function () {
            try {
                await verifyStartState();
                const tempToken = 'blah';

                const expired = await worker.expired(tempToken);

                assert.isFalse(expired);
            } catch (err) {
                assert.equal(err.message, "Access token is either the wrong client or expired");
            }
        });

        it("Check Expired Token - Invalid Token", async function () {
            try {
                await verifyStartState();
                const tempToken = '';

                const expired = await worker.expired(tempToken);

                assert.isFalse(expired);
            } catch (err) {
                assert.equal(err.message, "Access token is either the wrong client or expired");
            }
        });

        it("Verify Token", async function () {
            try {
                const results = await AwaitHelper.execute<boolean>(worker.verify(token));

                assert.isTrue(results);
            } catch (err) {
                throw new Error("verify token error: " + JSON.stringify(serializeError(err)));
            }
        });

        it("Verify Token - null token", async function () {
            try {
                await AwaitHelper.execute<boolean>(worker.verify(''));

                assert.fail("Expected an error");
            } catch (err) {
                assert.equal(err.message, "No access token was given");
            }
        });

        it("Verify Token - null token", async function () {
            try {
                await AwaitHelper.execute<boolean>(worker.verify(' '));

                assert.fail("Expected an error");
            } catch (err) {
                assert.equal(err.message, "No access token was given");
            }
        });

        it("Verify Token - expired token", async function () {
            try {
                await AwaitHelper.execute<boolean>(worker.verify('blah'));

                assert.fail("Expected an error");
            } catch (err) {
                assert.equal(err.message, "Signature verification failed");
            }
        });

        it("Verify Token - mismatching client", async function () {
            try {
                await AwaitHelper.execute<boolean>(worker.verify(''));

                assert.fail("Expected an error");
            } catch (err) {
                assert.equal(err.message, "Signature verification failed");
                    //"No audience granted");
            }
        });

        it("Verify Token - verify turned off", async function() {
            try {
                worker.config.metadata.verifyOn = 'false';
                await AwaitHelper.execute(worker.init(worker.config));
                const results = await AwaitHelper.execute<boolean>(worker.verify(""));

                assert.isTrue(results);
            } catch (err) {
                throw new Error("Verify Token - Verify Turned Off Error => " + JSON.stringify(serializeError(err)));
            }
        });
    });
})