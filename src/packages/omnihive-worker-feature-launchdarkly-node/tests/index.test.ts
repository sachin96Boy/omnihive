import { NodeServiceFactory } from "@withonevision/omnihive-core-node/factories/NodeServiceFactory";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { ObjectHelper } from "@withonevision/omnihive-core/helpers/ObjectHelper";
import { ServerSettings } from "@withonevision/omnihive-core/models/ServerSettings";
import { assert } from "chai";
import fs from "fs";
import { serializeError } from "serialize-error";
import LaunchDarklyNodeFeatureWorker from "..";
import packageJson from "../package.json";

const getConfig = function (): ServerSettings | undefined {
    try {
        if (!process.env.omnihive_test_worker_feature_launchdarkly_node) {
            return undefined;
        }

        const config: ServerSettings = ObjectHelper.create(
            ServerSettings,
            JSON.parse(
                fs.readFileSync(`${process.env.omnihive_test_worker_feature_launchdarkly_node}`, {
                    encoding: "utf8",
                })
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
let worker: LaunchDarklyNodeFeatureWorker = new LaunchDarklyNodeFeatureWorker();

describe("feature worker tests", function () {
    before(function () {
        const config: ServerSettings | undefined = getConfig();

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
            const result = await AwaitHelper.execute<void>(init());
            assert.isUndefined(result);
        });
    });

    describe("Worker Functions", function () {
        before(async function () {
            await init();
        });

        it("get feature - blank - with default", async function () {
            try {
                await AwaitHelper.execute<unknown>(worker.get("", false));

                assert.fail("Expected to fail");
            } catch (err) {
                assert.equal(err.message, "No feature name given.");
            }
        });
    });
});
