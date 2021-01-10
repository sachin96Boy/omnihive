import LaunchDarklyNodeFeatureFlagWorker from '..';
import { assert } from 'chai';
import fs from 'fs';
import { serializeError } from 'serialize-error';
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import { HiveWorkerType } from "@withonevision/omnihive-public-queen/enums/HiveWorkerType";
import { AwaitHelper } from "@withonevision/omnihive-public-queen/helpers/AwaitHelper";
import { QueenStore } from "@withonevision/omnihive-public-queen/stores/QueenStore";

const getConfigs = function (): any | undefined {
    try {
        if (!process.env.OH_ENV_FILE) {
            return undefined;
        }

        dotenvExpand(dotenv.config({ path: process.env.OH_ENV_FILE }));

        return JSON.parse(fs.readFileSync(`${process.env.OH_TEST_WORKER_FEATUREFLAG_LAUNCHDARKLY_NODE}`,
            { encoding: "utf8" }));
    } catch {
        return undefined;
    }
}


let worker: LaunchDarklyNodeFeatureFlagWorker = new LaunchDarklyNodeFeatureFlagWorker();
let configs: any | undefined;

describe('feature flag worker tests', function () {

    before(function () {
        configs = getConfigs();

        if (!configs) {
            this.skip();
        }
    });

    const init = async function (): Promise<void> {
        try {
            await AwaitHelper.execute(QueenStore.getInstance()
                .initWorkers(configs));
            const newWorker = QueenStore
                .getInstance()
                .workers
                .find((x) => x[0].type === HiveWorkerType.FeatureFlag);

            if (newWorker && newWorker[1]) {
                worker = newWorker[1];
            }
        } catch (err) {
            throw new Error("init failure: " + serializeError(JSON.stringify(err)));
        }
    }

    describe("Init functions", function () {
        it('test init', async function () {
            const result = await AwaitHelper.execute<void>(init());
            assert.isUndefined(result);
        });
    });


    describe("Worker Functions", function () {
        before(async function () {
            await init();
        });

        it("get flag - blank - with default", async function () {
            try {
                await AwaitHelper.execute<unknown>(worker.get("", false));

                assert.fail("Expected to fail");
            } catch (err) {
                assert.equal(err.message, "No flag name given.");
            }
        });
    });
})