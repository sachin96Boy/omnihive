import DayJsDateWorker from '..';
import { HiveWorkerType } from '@withonevision/omnihive-hive-common/enums/HiveWorkerType';
import { AwaitHelper } from '@withonevision/omnihive-hive-common/helpers/AwaitHelper';
import { HiveWorkerFactory } from '@withonevision/omnihive-hive-worker/HiveWorkerFactory';
import { assert } from 'chai';
import dayjs, { Dayjs } from 'dayjs';
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

        return JSON.parse(fs.readFileSync(`${process.env.OH_TEST_WORKER_DATE_DAYJS}`,
            { encoding: "utf8" }));
    } catch {
        return undefined;
    }
}

let worker: DayJsDateWorker = new DayJsDateWorker();
let configs: any | undefined;

describe('date worker tests', function () {

    before(function () {
        configs = getConfigs();

        if (!configs) {
            this.skip();
        }
    });

    const init = async function (): Promise<void> {
        try {
            await AwaitHelper.execute(HiveWorkerFactory.getInstance()
                .init(configs));
            const newWorker = HiveWorkerFactory
                .getInstance()
                .workers
                .find((x) => x[0].type === HiveWorkerType.Date);

            if (newWorker && newWorker[1]) {
                worker = newWorker[1];
            }
        } catch (err) {
            throw new Error("init failure: " + serializeError(JSON.stringify(err)));
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

        it("convert between timezones", function() {
            const convertDate: Dayjs = dayjs("2020-01-01T00:00:00");
            const result: string = worker.convertDateBetweenTimezones(convertDate.toDate(), "Asia/Tokyo", "America/New_York");
            const hourDiff: number = dayjs(result).diff(convertDate, "hour");
            assert.equal(hourDiff, 14);
        });

        it("convert between timezones - invalid", function() {
            try {
                const convertDate: Dayjs = dayjs("2020-01-01T00:00:00");
                worker.convertDateBetweenTimezones(convertDate.toDate(), "Bad Timezone", "America/New_York");
                assert.fail("Expected to fail");
            } catch (err) {
                assert.equal(err.message, "Could not convert timezones.  Check to make sure timezones are IANA-specific");
            }
        });

        it("convert between timezones - no from timezone", function() {
            const convertDate: Dayjs = dayjs("2020-01-01T00:00:00Z");
            const result: string = worker.convertDateBetweenTimezones(convertDate.toDate(), "Asia/Tokyo");
            const hourDiff: number = dayjs(result).diff(convertDate, "hour");
            assert.equal(hourDiff, 14);
        });

        it("Format Date", function() {
            const dateToConvert: Date = dayjs("2020-01-01T00:00:00").toDate();
            const dateString = worker.getFormattedDateString(dateToConvert, "MM/DD/YYYY hh:mma");
            assert.equal(dateString, "01/01/2020 12:00am");
        });

        it("Format Date - no format specified", function() {
            const dateToConvert: Date = dayjs("2020-01-01T00:00:00").toDate();
            const dateString = worker.getFormattedDateString(dateToConvert);
            assert.equal(dateString, "2020-01-01T00:00:00");
        });
    });
})