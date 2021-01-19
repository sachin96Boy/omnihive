import { AwaitHelper } from "@withonevision/omnihive-common/helpers/AwaitHelper";
import { ObjectHelper } from "@withonevision/omnihive-common/helpers/ObjectHelper";
import { ServerSettings } from "@withonevision/omnihive-common/models/ServerSettings";
import { CommonStore } from "@withonevision/omnihive-common/stores/CommonStore";
import { assert } from "chai";
import fs from "fs";
import { serializeError } from "serialize-error";
import AuthZeroTokenWorker from "..";
import packageJson from "../package.json";

const getConfig = function (): ServerSettings | undefined {
    try {
        if (!process.env.omnihive_test_worker_token_auth0) {
            return undefined;
        }

        const config: ServerSettings = ObjectHelper.create(
            ServerSettings,
            JSON.parse(fs.readFileSync(`${process.env.omnihive_test_worker_token_auth0}`, { encoding: "utf8" }))
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
let worker: AuthZeroTokenWorker = new AuthZeroTokenWorker();

describe("token worker tests", function () {
    let token: string = "";

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
            throw new Error("init error: " + JSON.stringify(serializeError(err)));
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
        };

        it("Get Token", async function () {
            try {
                token = await AwaitHelper.execute<string>(worker.get());

                assert.isTrue(token && token.length > 0);
            } catch (err) {
                throw new Error("get token error: " + JSON.stringify(serializeError(err)));
            }
        });

        it("Get Token - after token is retrieved", async function () {
            try {
                await AwaitHelper.execute<string>(worker.get());
                token = await AwaitHelper.execute<string>(worker.get());

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
                const tempToken = "blah";

                const expired = await worker.expired(tempToken);

                assert.isFalse(expired);
            } catch (err) {
                assert.equal(err.message, "Access token is either the wrong client or expired");
            }
        });

        it("Check Expired Token - Invalid Token", async function () {
            try {
                await verifyStartState();
                const tempToken = "";

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
                await AwaitHelper.execute<boolean>(worker.verify(""));

                assert.fail("Expected an error");
            } catch (err) {
                assert.equal(err.message, "No access token was given");
            }
        });

        it("Verify Token - null token", async function () {
            try {
                await AwaitHelper.execute<boolean>(worker.verify(" "));

                assert.fail("Expected an error");
            } catch (err) {
                assert.equal(err.message, "No access token was given");
            }
        });

        it("Verify Token - expired token", async function () {
            try {
                await AwaitHelper.execute<boolean>(worker.verify("blah"));

                assert.fail("Expected an error");
            } catch (err) {
                assert.equal(err.message, "Signature verification failed");
            }
        });

        it("Verify Token - mismatching client", async function () {
            try {
                await AwaitHelper.execute<boolean>(worker.verify(""));

                assert.fail("Expected an error");
            } catch (err) {
                assert.equal(err.message, "Signature verification failed");
                //"No audience granted");
            }
        });

        it("Verify Token - verify turned off", async function () {
            try {
                worker.config.metadata.verifyOn = "false";
                await AwaitHelper.execute(worker.init(worker.config));
                const results = await AwaitHelper.execute<boolean>(worker.verify(""));

                assert.isTrue(results);
            } catch (err) {
                throw new Error("Verify Token - Verify Turned Off Error => " + JSON.stringify(serializeError(err)));
            }
        });
    });
});
