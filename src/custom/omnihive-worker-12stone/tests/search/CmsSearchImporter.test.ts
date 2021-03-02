import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { assert } from "chai";
import { serializeError } from "serialize-error";
import { TestConfigSettings } from "../../../../tests/models/TestConfigSettings";
import { TestService } from "../../../../tests/services/TestService";
import CmsSearchImporter from "../../search/task/CmsSearchImporter";
import packageJson from "../../package.json";

let settings: TestConfigSettings;
let worker: CmsSearchImporter | undefined = undefined;
const testService: TestService = new TestService();

describe("CMS Search Tests", async function () {
    before(async function () {
        const config: TestConfigSettings | undefined = testService.getTestConfig(packageJson.name);

        if (!config) {
            this.skip();
        }

        testService.clearWorkers();
        settings = config;

        await AwaitHelper.execute(testService.initWorkers(settings.workers));
        const newWorker = testService.registeredWorkers.find((x) => x.name === "CmsSearchImporter");

        if (newWorker && newWorker.instance) {
            worker = newWorker.instance;
        }
    });

    const callImporter = async () => {
        try {
            await AwaitHelper.execute<void>(worker.execute());
        } catch (err) {
            throw new Error(serializeError(err));
        }
    };

    it("search importer - main", async function () {
        try {
            await AwaitHelper.execute<void>(callImporter());
            assert.ok(true);
        } catch (err) {
            assert.fail(JSON.stringify(serializeError(err)));
        }
    });
});
