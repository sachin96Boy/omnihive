import { expect } from "chai";
import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import faker from "faker";
import ConsoleLogWorker from "..";
import sinon from "sinon";
import { OmniHiveLogLevel } from "@withonevision/omnihive-core/enums/OmniHiveLogLevel";

const testValues = {
    logOutput: faker.datatype.string(),
    workerName: "testLogConsoleWorker",
};

const initWorker = async (): Promise<ConsoleLogWorker> => {
    const worker: ConsoleLogWorker = new ConsoleLogWorker();
    await AwaitHelper.execute(worker.init(testValues.workerName));
    return worker;
};

describe("Worker Test - Log - Console", () => {
    describe("Init Functions", () => {
        it("Test Init", async () => {
            await AwaitHelper.execute(initWorker());
        });
    });

    describe("Worker Functions", async () => {
        it(`Console Log Output`, async () => {
            const worker = await AwaitHelper.execute(initWorker());
            const spy = sinon.spy(console, "log");
            worker.write(OmniHiveLogLevel.Info, testValues.logOutput);
            expect(spy.calledWith(testValues.logOutput)).to.be.true;
        });
    });
});
