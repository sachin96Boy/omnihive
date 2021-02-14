import { NodeServiceFactory } from "@withonevision/omnihive-core-node/factories/NodeServiceFactory";
import { CoreServiceFactory } from "@withonevision/omnihive-core/factories/CoreServiceFactory";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { TestConfigSettings } from "@withonevision/omnihive-core/models/TestConfigSettings";
import { assert } from "chai";
import { serializeError } from "serialize-error";
import PusherPubSubServerWorker from "..";
import packageJson from "../package.json";

let settings: TestConfigSettings;
let worker: PusherPubSubServerWorker = new PusherPubSubServerWorker();

describe("pubsub server worker tests", function () {
    before(function () {
        const config: TestConfigSettings | undefined = NodeServiceFactory.testService.getTestConfig(packageJson.name);

        if (!config) {
            this.skip();
        }

        CoreServiceFactory.workerService.clearWorkers();
        settings = config;
    });

    const init = async function (): Promise<void> {
        try {
            await AwaitHelper.execute(CoreServiceFactory.workerService.initWorkers(settings.workers));
            const newWorker = CoreServiceFactory.workerService
                .getAllWorkers()
                .find((x) => x[0].package === packageJson.name);

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

        it("emit", async function () {
            try {
                const result = await worker.emit("jest-test-channel", "successful test", {});
                assert.isUndefined(result);
            } catch (err) {
                throw new Error("emit error: " + JSON.stringify(serializeError(err)));
            }
        });

        // TODO: Check client to make sure emitted message was received.
    });
});
