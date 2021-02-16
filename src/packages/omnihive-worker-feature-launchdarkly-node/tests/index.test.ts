import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { assert } from "chai";
import { serializeError } from "serialize-error";
import LaunchDarklyNodeFeatureWorker from "..";
import { TestConfigSettings } from "../../../tests/models/TestConfigSettings";
import { TestService } from "../../../tests/services/TestService";
import packageJson from "../package.json";

let settings: TestConfigSettings;
let worker: LaunchDarklyNodeFeatureWorker = new LaunchDarklyNodeFeatureWorker();
const testService: TestService = new TestService();

describe("feature worker tests", function () {
    before(function () {
        const config: TestConfigSettings | undefined = testService.getTestConfig(packageJson.name);

        if (!config) {
            this.skip();
        }

        testService.clearWorkers();
        settings = config;
    });

    const init = async function (): Promise<void> {
        const testService: TestService = new TestService();

        try {
            await AwaitHelper.execute(testService.initWorkers(settings.workers));
            const newWorker = testService.registeredWorkers.find((x) => x[0].package === packageJson.name);

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
