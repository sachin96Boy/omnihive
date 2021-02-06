import { NodeServiceFactory } from "@withonevision/omnihive-core-node/factories/NodeServiceFactory";
import { CoreServiceFactory } from "@withonevision/omnihive-core/factories/CoreServiceFactory";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { PubSubListener } from "@withonevision/omnihive-core/models/PubSubListener";
import { TestConfigSettings } from "@withonevision/omnihive-core/models/TestConfigSettings";
import { assert } from "chai";
import { serializeError } from "serialize-error";
import PusherJsPubSubClientWorker from "..";
import packageJson from "../package.json";

let settings: TestConfigSettings;
let worker: PusherJsPubSubClientWorker = new PusherJsPubSubClientWorker();

describe("pubsub client worker tests", function () {
    before(function () {
        const config: TestConfigSettings | undefined = NodeServiceFactory.testService.getTestConfig(packageJson.name);

        if (!config) {
            this.skip();
        }

        CoreServiceFactory.workerService.clearWorkers();
        settings = config;
    });

    const init = async (): Promise<void> => {
        try {
            await AwaitHelper.execute(CoreServiceFactory.workerService.initWorkers(settings.workers));
            const newWorker = CoreServiceFactory.workerService.registeredWorkers.find(
                (x) => x[0].package === packageJson.name
            );

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

        const channelName: string = "jest-test-channel";
        const eventName: string = "jest-test-event";
        const message: string = "I clicked it, it works!";

        const verifyStartState = (addListener: boolean = false): void => {
            try {
                worker.connect();

                if (addListener) {
                    worker.addListener(channelName, eventName, function (msg: string) {
                        assert.equal(msg, message);
                    });
                }
            } catch (err) {
                throw new Error("setup error: " + JSON.stringify(serializeError(err)));
            }
        };

        it("connect", function () {
            assert.doesNotThrow(worker.connect);
        });

        it("join channel", function () {
            verifyStartState();

            assert.doesNotThrow(function () {
                worker.joinChannel(channelName);
            });
        });

        it("leave channel", function () {
            verifyStartState(true);

            assert.doesNotThrow(function () {
                worker.leaveChannel(channelName);
            });
        });

        it("add listener", function () {
            verifyStartState();

            assert.doesNotThrow(function () {
                worker.addListener(channelName, eventName);
            });
        });

        it("remove listener", function () {
            verifyStartState(true);

            assert.doesNotThrow(function () {
                worker.removeListener(channelName, eventName);
            });
        });

        it("get channels", function () {
            verifyStartState(true);

            const channels = worker.getJoinedChannels();

            assert.equal(channels[0], channelName);
        });

        it("get listeners", function () {
            verifyStartState(true);

            const listeners = worker.getListeners();
            const retrievedValues = listeners.map((x: PubSubListener) => ({
                channelName: x.channelName,
                eventName: x.eventName,
            }));
            const verifiedValue = {
                channelName,
                eventName,
            };

            assert.equal(retrievedValues[0].channelName, verifiedValue.channelName);
            assert.equal(retrievedValues[0].eventName, verifiedValue.eventName);
        });

        it("disconnect", function () {
            verifyStartState();

            assert.doesNotThrow(worker.disconnect);
        });

        // TODO: Test with server to verify emits are heard.
    });
});
