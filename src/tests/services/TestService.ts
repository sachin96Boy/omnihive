import { ObjectHelper } from "../../packages/omnihive-core/helpers/ObjectHelper";
import { TestConfigSettings } from "../models/TestConfigSettings";
import { TestSettings } from "../models/TestSettings";
import { WorkerSetterBase } from "../../packages/omnihive-core/models/WorkerSetterBase";
import fse from "fs-extra";

export class TestService extends WorkerSetterBase {
    public clearWorkers = (): void => {
        this.registeredWorkers = [];
    };

    public getConstants = (): { [key: string]: string }[] | undefined => {
        try {
            if (!process.env.omnihive_test_settings) {
                return undefined;
            }

            const config: TestSettings = ObjectHelper.create(
                TestSettings,
                JSON.parse(fse.readFileSync(`${process.env.omnihive_test_settings}`, { encoding: "utf8" }))
            );

            return config.constants;
        } catch {
            return undefined;
        }
    };

    public getTestConfig = (packageName: string): TestConfigSettings | undefined => {
        try {
            if (!process.env.omnihive_test_settings) {
                return undefined;
            }

            const config: TestSettings = ObjectHelper.create(
                TestSettings,
                JSON.parse(fse.readFileSync(`${process.env.omnihive_test_settings}`, { encoding: "utf8" }))
            );

            return config.tests.find(
                (test: TestConfigSettings) => test.package === packageName && test.enabled === true
            );
        } catch {
            return undefined;
        }
    };
}
