import ElasticLogWorker from '..';
import { assert } from 'chai';
import fs from 'fs';
import { serializeError } from 'serialize-error';
import { OmniHiveLogLevel } from "@withonevision/omnihive-common/enums/OmniHiveLogLevel";
import { AwaitHelper } from "@withonevision/omnihive-common/helpers/AwaitHelper";
import { CommonStore } from "@withonevision/omnihive-common/stores/CommonStore";
import { ObjectHelper } from "@withonevision/omnihive-common/helpers/ObjectHelper";
import { ServerSettings } from "@withonevision/omnihive-common/models/ServerSettings";
import packageJson from "../package.json";

const getConfig = function (): ServerSettings | undefined {
    
    try {
        if (!process.env.OH_SETTINGS_FILE) {
            return undefined;
        }

        const config: ServerSettings = ObjectHelper.createStrict(ServerSettings, JSON.parse(
            fs.readFileSync(`${process.env.OH_SETTINGS_FILE}`,
                { encoding: "utf8" })));

        if (!config.workers.some((worker) => worker.package === packageJson.name)) {
            return undefined;
        }

        return config;
    } catch {
        return undefined;
    }
}

let settings: ServerSettings;
let worker: ElasticLogWorker = new ElasticLogWorker();

describe('log worker tests', function () {

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
            await AwaitHelper.execute(CommonStore.getInstance()
                .initWorkers(settings.workers));
            const newWorker = CommonStore
                .getInstance()
                .workers
                .find((x) => x[0].package === packageJson.name);

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

        it("write to log", async function () {
            try {
                const result = await worker.write(OmniHiveLogLevel.Info, "OmniHive Test Case => Valid test log message.");
                assert.isUndefined(result);
            } catch (err) {
                console.log(serializeError(err));
                assert.fail(err);
            }
        })
    });
})