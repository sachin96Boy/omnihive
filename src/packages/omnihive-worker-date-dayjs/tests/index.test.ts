import { expect } from "chai";
import dayjs from "dayjs";
import DayJsDateWorker from "..";
import { TestConfigSettings } from "../../../tests/models/TestConfigSettings";
import { TestService } from "../../../tests/services/TestService";
import packageJson from "../package.json";

const testService = new TestService();
const {
    workers: [config],
} = <TestConfigSettings>testService.getTestConfig(packageJson.name);
const worker = new DayJsDateWorker();

const mockDate = dayjs("2020-01-01T00:00:00").toDate();

describe("date worker tests", () => {
    describe("init functions", () => {
        it("test init", async () => {
            await worker.init(config);
            expect(worker.config).to.be.an("object");
        });
    });
    describe("worker functions", () => {
        it("convert between timezones", () => {
            const result = worker.convertDateBetweenTimezones(mockDate, "Asia/Tokyo", "America/New_York");
            const diff = dayjs(result).diff(mockDate, "hour");
            expect(diff).to.equal(14);
        });
        it("convert between timezones - invalid from", () => {
            expect(() => worker.convertDateBetweenTimezones(mockDate, "Bad timezone", "America/New_York")).to.throw(
                /Could not convert timezones/
            );
        });
        it("convert between timezones - invalid to", () => {
            expect(() => worker.convertDateBetweenTimezones(mockDate, "Asia/Tokyo", "Bad timezone")).to.throw(
                /Could not convert timezones/
            );
        });
        it("convert between timezones - no from timezone", () => {
            const result = worker.convertDateBetweenTimezones(mockDate, "Asia/Tokyo");
            const diff = dayjs(result).diff(mockDate, "hour");
            expect(diff).to.equal(14);
        });
        it("format date", () => {
            const dateString = worker.getFormattedDateString(mockDate, "MM/DD/YYYY hh:mma");
            expect(dateString).to.equal("01/01/2020 12:00am");
        });
        it("format date - no format specified", () => {
            const dateString = worker.getFormattedDateString(mockDate);
            expect(dateString).to.equal("2020-01-01T00:00:00");
        });
    });
});
