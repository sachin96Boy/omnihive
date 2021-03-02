import { NodeServiceFactory } from "@withonevision/omnihive-core-node/factories/NodeServiceFactory";
import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { CoreServiceFactory } from "@withonevision/omnihive-core/factories/CoreServiceFactory";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { TestConfigSettings } from "@withonevision/omnihive-core/models/TestConfigSettings";
import { ITaskEndpointWorker } from "@withonevision/omnihive-core/interfaces/ITaskEndpointWorker";
import { assert } from "chai";
import { serializeError } from "serialize-error";
import packageJson from "../../package.json";

let settings: TestConfigSettings;

describe("CMS Search Tests", async function () {
    before(async function () {
        const config: TestConfigSettings | undefined = NodeServiceFactory.testService.getTestConfig(packageJson.name);

        if (!config) {
            this.skip();
        }

        CoreServiceFactory.workerService.clearWorkers();
        await CoreServiceFactory.workerService.initWorkers(config.workers);
        settings = config;
    });

    const callImporter = async () => {
        try {
            const worker: ITaskEndpointWorker = (await CoreServiceFactory.workerService.getWorker(
                HiveWorkerType.TaskFunction,
                "CmsSearchImporter"
            )) as ITaskEndpointWorker;
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
