import PusherJsPubSubClientWorker from '..';
import { assert } from 'chai';
import fs from 'fs';
import { serializeError } from 'serialize-error';
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import { HiveWorkerType } from "@withonevision/omnihive-common/enums/HiveWorkerType";
import { AwaitHelper } from "@withonevision/omnihive-common/helpers/AwaitHelper";
import { PubSubListener } from "@withonevision/omnihive-common/models/PubSubListener";
import { CommonStore } from "@withonevision/omnihive-common/stores/CommonStore";

const getConfigs = function (): any | undefined {
    try {
        if (!process.env.OH_ENV_FILE) {
            return undefined;
        }

        dotenvExpand(dotenv.config({ path: process.env.OH_ENV_FILE }));

        return JSON.parse(fs.readFileSync(`${process.env.OH_TEST_WORKER_PUBSUBCLIENT_PUSHERJS}`,
            { encoding: "utf8" }));
    } catch {
        return undefined;
    }
}


describe('pubsub client worker tests', function () {
    let configs: any | undefined;
    let worker: PusherJsPubSubClientWorker = new PusherJsPubSubClientWorker();

    before(function () {
        configs = getConfigs();

        if (!configs) {
            this.skip();
        }
    });

    const init = async (): Promise<void> => {
        try {
            await AwaitHelper.execute(CommonStore.getInstance()
                .initWorkers(configs));
            const newWorker = CommonStore
                .getInstance()
                .workers
                .find((x) => x[0].type === HiveWorkerType.PubSubClient);

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
        }

        it("connect", function () {
            assert.doesNotThrow(worker.connect);
        });

        it("join channel", function () {
            verifyStartState();

            assert.doesNotThrow(function () { worker.joinChannel(channelName) });
        });

        it("leave channel", function () {
            verifyStartState(true);

            assert.doesNotThrow(function () { worker.leaveChannel(channelName) });
        });

        it("add listener", function () {
            verifyStartState();

            assert.doesNotThrow(function () { worker.addListener(channelName, eventName) });
        });

        it("remove listener", function () {
            verifyStartState(true);

            assert.doesNotThrow(function () { worker.removeListener(channelName, eventName) });
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
                eventName: x.eventName
            }));
            const verifiedValue = {
                channelName,
                eventName
            }

            assert.equal(retrievedValues[0].channelName, verifiedValue.channelName);
            assert.equal(retrievedValues[0].eventName, verifiedValue.eventName)
        })

        it("disconnect", function () {
            verifyStartState();

            assert.doesNotThrow(worker.disconnect);
        });

        // TODO: Test with server to verify emits are heard.
    });
})