import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { assert } from "chai";
import dayjs, { Dayjs } from "dayjs";
import { serializeError } from "serialize-error";
import DayJsDateWorker from "..";
import { TestConfigSettings } from "../../../tests/models/TestConfigSettings";
import { TestService } from "../../../tests/services/TestService";
import packageJson from "../package.json";

let settings: TestConfigSettings;
let worker: DayJsDateWorker = new DayJsDateWorker();

describe("date worker tests", function () {
    before(function () {
        const testService: TestService = new TestService();
        const config: TestConfigSettings | undefined = testService.getTestConfig(packageJson.name);

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
            throw new Error("init failure: " + serializeError(JSON.stringify(err)));
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

        it("convert between timezones", function () {
            const convertDate: Dayjs = dayjs("2020-01-01T00:00:00");
            const result: string = worker.convertDateBetweenTimezones(
                convertDate.toDate(),
                "Asia/Tokyo",
                "America/New_York"
            );
            const hourDiff: number = dayjs(result).diff(convertDate, "hour");
            assert.equal(hourDiff, 14);
        });

        it("convert between timezones - invalid", function () {
            try {
                const convertDate: Dayjs = dayjs("2020-01-01T00:00:00");
                worker.convertDateBetweenTimezones(convertDate.toDate(), "Bad Timezone", "America/New_York");
                assert.fail("Expected to fail");
            } catch (err) {
                assert.equal(
                    err.message,
                    "Could not convert timezones.  Check to make sure timezones are IANA-specific"
                );
            }
        });

        it("convert between timezones - no from timezone", function () {
            const convertDate: Dayjs = dayjs("2020-01-01T00:00:00Z");
            const result: string = worker.convertDateBetweenTimezones(convertDate.toDate(), "Asia/Tokyo");
            const hourDiff: number = dayjs(result).diff(convertDate, "hour");
            assert.equal(hourDiff, 14);
        });

        it("Format Date", function () {
            const dateToConvert: Date = dayjs("2020-01-01T00:00:00").toDate();
            const dateString = worker.getFormattedDateString(dateToConvert, "MM/DD/YYYY hh:mma");
            assert.equal(dateString, "01/01/2020 12:00am");
        });

        it("Format Date - no format specified", function () {
            const dateToConvert: Date = dayjs("2020-01-01T00:00:00").toDate();
            const dateString = worker.getFormattedDateString(dateToConvert);
            assert.equal(dateString, "2020-01-01T00:00:00");
        });
    });
});
