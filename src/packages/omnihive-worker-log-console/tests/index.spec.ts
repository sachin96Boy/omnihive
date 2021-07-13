import { expect } from "chai";
import { AwaitHelper } from "../../omnihive-core/helpers/AwaitHelper";
import faker from "faker";
import ConsoleLogWorker from "..";
import sinon from "sinon";
import { OmniHiveLogLevel } from "../../omnihive-core/enums/OmniHiveLogLevel";

class TestSetup {
    public logOutput: string = faker.datatype.string();
    public worker: ConsoleLogWorker = new ConsoleLogWorker();
    public workerName: string = "testLogConsoleWorker";
}

const testSetup: TestSetup = new TestSetup();

describe("Worker Test - Log - Console", () => {
    describe("Init Functions", () => {
        it("Test Init", async () => {
            await AwaitHelper.execute(testSetup.worker.init(testSetup.workerName));
        });
    });

    describe("Worker Functions", () => {
        it(`Console Log Output`, async () => {
            const spy = sinon.spy(console, "log");
            testSetup.worker.write(OmniHiveLogLevel.Info, testSetup.logOutput);
            expect(spy.calledWith(testSetup.logOutput)).to.be.true;
        });
    });
});
