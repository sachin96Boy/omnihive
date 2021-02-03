import { ObjectHelper } from "@withonevision/omnihive-core/helpers/ObjectHelper";
import { TestConfigSettings } from "@withonevision/omnihive-core/models/TestConfigSettings";
import { TestSettings } from "@withonevision/omnihive-core/models/TestSettings";
import fs from "fs";

export class TestService {
    private static singleton: TestService;

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    private constructor() {}

    public static getSingleton = (): TestService => {
        if (!TestService.singleton) {
            TestService.singleton = new TestService();
        }

        return TestService.singleton;
    };

    public getConstants = (): { [key: string]: string }[] | undefined => {
        try {
            if (!process.env.omnihive_test_settings) {
                return undefined;
            }

            const config: TestSettings = ObjectHelper.create(
                TestSettings,
                JSON.parse(fs.readFileSync(`${process.env.omnihive_test_settings}`, { encoding: "utf8" }))
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
                JSON.parse(fs.readFileSync(`${process.env.omnihive_test_settings}`, { encoding: "utf8" }))
            );

            return config.tests.find(
                (test: TestConfigSettings) => test.package === packageName && test.enabled === true
            );
        } catch {
            return undefined;
        }
    };
}
