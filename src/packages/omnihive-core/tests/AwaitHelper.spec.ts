import { AwaitHelper } from "../helpers/AwaitHelper";
import { expect } from "chai";
import faker from "faker";

class TestSetup {
    public testString: string = faker.datatype.string();
    public milliseconds: number = 10;

    public failFunction = async (): Promise<string> => {
        return new Promise<string>((_resolve, reject) => setTimeout(() => reject(this.testString), this.milliseconds));
    };

    public successFunction = async (): Promise<string> => {
        return new Promise<string>((resolve) => setTimeout(() => resolve(this.testString), this.milliseconds));
    };
}

const testSetup: TestSetup = new TestSetup();

describe("AwaitHelper Tests", async () => {
    it("Success Call", async () => {
        const result = await AwaitHelper.execute(testSetup.successFunction());
        expect(result).equal(testSetup.testString);
    });

    it("Failure Call", async () => {
        try {
            await AwaitHelper.execute(testSetup.failFunction());
            expect.fail("Function Should Have Failed");
        } catch (err) {
            expect(err).to.equal(testSetup.testString);
        }
    });
});
