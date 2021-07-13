import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { expect } from "chai";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import tz from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import DayJsDateWorker from "..";
import faker from "faker";

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(tz);

class TestSetup {
    public conversionUnit: dayjs.UnitTypeLong = "hour";
    public dateFormatInvalid: string = "YYYY-MM-DDTHH:mm:ssX";
    public dateFormatValid: string = "MM/DD/YYYY hh:mma";
    public dateFormatValidAlternate: string = "YYYY-MM-DDTHH:mm:ssZ";
    public homeTimezone = "America/New_York";
    public invalidTimezone = "Bad Timezone";
    public otherTimezone = "Asia/Tokyo";
    public workerInvalid: DayJsDateWorker = new DayJsDateWorker();
    public workerValid: DayJsDateWorker = new DayJsDateWorker();
    public workerName: string = "testDateDayJSDateWorker";
}

const testSetup = new TestSetup();

describe("Worker Test - Date - DayJS", () => {
    describe("Init Functions", () => {
        it("Test Init - Valid Date Format", async () => {
            await AwaitHelper.execute(
                testSetup.workerValid.init(testSetup.workerName, { dateFormat: testSetup.dateFormatValid })
            );
        });

        it("Test Init - Invalid Date Format", async () => {
            try {
                await AwaitHelper.execute(
                    testSetup.workerInvalid.init(testSetup.workerName, { dateFormat: testSetup.dateFormatInvalid })
                );
                expect.fail("Method Expected to Fail");
            } catch (err) {
                expect(err).to.be.an.instanceOf(Error);
            }
        });
    });

    describe("Worker Functions", () => {
        it("Convert Between Timezones", () => {
            const testDate: Date = faker.date.soon();
            const result = testSetup.workerValid.convertDateBetweenTimezones(
                testDate,
                testSetup.otherTimezone,
                testSetup.homeTimezone
            );
            expect(result).to.equal(dayjs(testDate).tz(testSetup.otherTimezone).format(testSetup.dateFormatValid));
        });

        it("Convert Between Timezones - Invalid From", () => {
            try {
                const testDate: Date = faker.date.soon();
                testSetup.workerValid.convertDateBetweenTimezones(
                    testDate,
                    testSetup.invalidTimezone,
                    testSetup.homeTimezone
                );

                expect.fail("Method Expected To Fail");
            } catch (err) {
                expect(err).to.be.an.instanceOf(Error);
            }
        });

        it("Convert Between Timezones - Invalid To", () => {
            try {
                const testDate: Date = faker.date.soon();
                testSetup.workerValid.convertDateBetweenTimezones(
                    testDate,
                    testSetup.otherTimezone,
                    testSetup.invalidTimezone
                );

                expect.fail("Method Expected To Fail");
            } catch (err) {
                expect(err).to.be.an.instanceOf(Error);
            }
        });

        it("Convert Between Timezones - No From Timezone", () => {
            const testDate: Date = faker.date.soon();
            const result = testSetup.workerValid.convertDateBetweenTimezones(testDate, testSetup.otherTimezone);
            expect(result).to.equal(dayjs(testDate).tz(testSetup.otherTimezone).format(testSetup.dateFormatValid));
        });

        it("Format Date", () => {
            const testDate: Date = faker.date.soon();
            const dateString = testSetup.workerValid.getFormattedDateString(
                testDate,
                testSetup.dateFormatValidAlternate
            );
            expect(dateString).to.equal(dayjs(testDate).format(testSetup.dateFormatValidAlternate));
        });

        it("Format Date - No Format Specified", () => {
            const testDate: Date = faker.date.soon();
            const dateString = testSetup.workerValid.getFormattedDateString(testDate);
            expect(dateString).to.equal(dayjs(testDate).format(testSetup.dateFormatValid));
        });
    });
});
