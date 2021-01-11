import ElasticLogWorker from '..';
import { assert } from 'chai';
import fs from 'fs';
import { serializeError } from 'serialize-error';
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import { HiveWorkerType } from "@withonevision/omnihive-queen/enums/HiveWorkerType";
import { OmniHiveLogLevel } from "@withonevision/omnihive-queen/enums/OmniHiveLogLevel";
import { AwaitHelper } from "@withonevision/omnihive-queen/helpers/AwaitHelper";
import { QueenStore } from "@withonevision/omnihive-queen/stores/QueenStore";

const getConfigs = function (): any | undefined {
    try {
        if (!process.env.OH_ENV_FILE) {
            return undefined;
        }

        dotenvExpand(dotenv.config({ path: process.env.OH_ENV_FILE }));

        return JSON.parse(fs.readFileSync(`${process.env.OH_TEST_WORKER_LOG_ELASTIC}`,
            { encoding: "utf8" }));
    } catch {
        return undefined;
    }
}

describe('log worker tests', function () {
    let configs: any | undefined;
    let worker: ElasticLogWorker = new ElasticLogWorker();

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
                .find((x) => x[0].type === HiveWorkerType.Log);

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