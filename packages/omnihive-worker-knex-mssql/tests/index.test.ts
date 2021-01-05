import MssqlDatabaseWorker from '..';
import { HiveWorkerType } from '@withonevision/omnihive-hive-common/enums/HiveWorkerType';
import { AwaitHelper } from '@withonevision/omnihive-hive-common/helpers/AwaitHelper';
import { HiveWorker } from '@withonevision/omnihive-hive-common/models/HiveWorker';
import { StoredProcSchema } from '@withonevision/omnihive-hive-common/models/StoredProcSchema';
import { HiveWorkerFactory } from '@withonevision/omnihive-hive-worker/HiveWorkerFactory';
import { assert } from 'chai';
import fs from 'fs';
import { serializeError } from 'serialize-error';
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";

const getConfigs = function (): any | undefined {
    try {
        if (!process.env.OH_ENV_FILE) {
            return undefined;
        }

        dotenvExpand(dotenv.config({ path: process.env.OH_ENV_FILE }));

        return JSON.parse(fs.readFileSync(`${process.env.OH_TEST_WORKER_KNEX_MSSQL}`,
            { encoding: "utf8" }));
    } catch {
        return undefined;
    }
}


let configs: HiveWorker[] | undefined;

describe('mssql database worker tests', function () {

    before(function () {
        configs = getConfigs();

        if (!configs) {
            this.skip();
        }
    });

    let worker: MssqlDatabaseWorker = new MssqlDatabaseWorker();

    const init = async function (testingConfigs: any): Promise<void> {
        try {
            await AwaitHelper.execute(HiveWorkerFactory.getInstance()
                .init(testingConfigs));
            const newWorker = HiveWorkerFactory
                .getInstance()
                .workers
                .find((x) => x[0].type === HiveWorkerType.Database);

            if (newWorker && newWorker[1]) {
                worker = newWorker[1];
            }
        } catch (err) {
            throw new Error(err.message);
        }
    }

    const sleep = async function (milliseconds: number): Promise<void> {
        return new Promise<void>(resolve => setTimeout(resolve, milliseconds));
    }

    describe("Init Functions", function () {

        beforeEach(async function () {
            HiveWorkerFactory.getInstance().clearWorkers();
        });

        it('test valid init', async function () {
            try {
                const results = await AwaitHelper.execute<void>(init(configs));
                await sleep(1000);

                assert.isUndefined(results);
            } catch (err) {
                throw new Error("mssql init error => " + JSON.stringify(serializeError(err.message)));
            }
        });

        it('test invalid database config', async function () {
            try {
                const partialConfig = JSON.parse(JSON.stringify(configs));
                partialConfig.forEach((x: HiveWorker) => {
                    if (x.type === HiveWorkerType.Database) {
                        x.metadata = {};
                    }
                });

                await AwaitHelper.execute<void>(init(partialConfig));
            } catch (err) {
                assert.match(err.message, /.*Metadata key.*/gm);
            }
        });

        it('test missing log config', async function () {
            try {
                const partialConfig = configs?.filter((x: HiveWorker) =>
                    x.type !== HiveWorkerType.Log);

                await AwaitHelper.execute<void>(init(partialConfig));
            } catch (err) {
                assert.match(err.message, /.*Log Worker Not Defined.*/gm);
            }
        });

        it('test invalid log config', async function () {
            try {
                const partialConfig = JSON.parse(JSON.stringify(configs));
                partialConfig.forEach((x: HiveWorker) => {
                    if (x.type === HiveWorkerType.Log) {
                        x.metadata = {};
                    }
                });

                await AwaitHelper.execute<void>(init(partialConfig));
            } catch (err) {
                assert.match(err.message, /.*Metadata key.*/gm);
            }
        });
    });


    describe("Worker Functions", function () {

        const wipeData = async function (): Promise<void> {
            const schema: StoredProcSchema = new StoredProcSchema();
            schema.schema = "dbo";
            schema.storedProcName = "test_truncate_jest_testing"
            await worker.executeStoredProcedure(schema, []);
        }

        before(async function () {
            await init(configs);
            await sleep(1000);
        });

        beforeEach(async function () {
            await wipeData();
        });

        afterEach(async function () {
            await wipeData();
        })

        it("execute query", async function () {
            const proc = `
                insert into dbo.jest_testing (
                    [data]
                )
                values (
                    'Testing Values 1'
                );

                select jt.[data]
                from dbo.jest_testing as jt;
            `;
            const result = await worker.executeQuery(proc);

            assert.strictEqual(result[0][0].data, "Testing Values 1");
        });

        it("execute stored procedure", async function () {
            const schema: StoredProcSchema = new StoredProcSchema();
            schema.schema = "dbo";
            schema.storedProcName = "test_stored_proc_call";
            const result = await worker.executeStoredProcedure(schema,
                [
                    { name: "Value", value: "Testing Values ", isString: true },
                    { name: "Numeric", value: 1, isString: false }
                ]);

            assert.equal(result[0][0].data, "Testing Values 1");
        });

        it("execute stored procedure with no schema", async function () {
            const schema: StoredProcSchema = new StoredProcSchema();
            schema.storedProcName = "test_stored_proc_call";
            const result = await worker.executeStoredProcedure(schema,
                [
                    { name: "Value", value: "Testing Values ", isString: true },
                    { name: "Numeric", value: 1, isString: false }
                ]);

            assert.equal(result[0][0].data, "Testing Values 1");
        });

        it("get schema", async function () {
            const results = await worker.getSchema();

            assert.equal(results.tables[0].tableName, "jest_testing");
            assert.equal(results.storedProcs.length, 5);
        });
    });
})