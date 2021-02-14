import { NodeServiceFactory } from "@withonevision/omnihive-core-node/factories/NodeServiceFactory";
import { OmniHiveLogLevel } from "@withonevision/omnihive-core/enums/OmniHiveLogLevel";
import { CoreServiceFactory } from "@withonevision/omnihive-core/factories/CoreServiceFactory";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { TestConfigSettings } from "@withonevision/omnihive-core/models/TestConfigSettings";
import { assert } from "chai";
import { serializeError } from "serialize-error";
import ElasticLogWorker from "..";
import packageJson from "../package.json";

let settings: TestConfigSettings;
let worker: ElasticLogWorker = new ElasticLogWorker();

describe("log worker tests", function () {
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

        it("write to log", async function () {
            try {
                const result = await worker.write(
                    OmniHiveLogLevel.Info,
                    "OmniHive Test Case => Valid test log message."
                );
                assert.isUndefined(result);
            } catch (err) {
                console.log(serializeError(err));
                assert.fail(err);
            }
        });
    });
});
