import { TestConfigSettings } from "../../../tests/models/TestConfigSettings";
import { TestService } from "../../../tests/services/TestService";
import packageJson from "../package.json";
import { OmniHiveClient } from "../index";
import { assert } from "chai";
import { ServerSettings } from "@withonevision/omnihive-core/models/ServerSettings";

let settings: TestConfigSettings;
const testService: TestService = new TestService();

describe("client tests", function () {
    before(function () {
        const config: TestConfigSettings | undefined = testService.getTestConfig(packageJson.name);

        if (!config) {
            this.skip();
        }

        testService.clearWorkers();
        settings = config;
    });

    describe("init tests", function () {
        it("get new", function () {
            assert.instanceOf(OmniHiveClient.getNew(), OmniHiveClient);
        });

        it("get singleton", function () {
            assert.instanceOf(OmniHiveClient.getSingleton(), OmniHiveClient);
        });

        it("init", async function () {
            const serverSettings: ServerSettings = {
                config: {
                    adminPortNumber: 7000,
                    adminPassword: "Testing Things for now",
                    nodePortNumber: 3001,
                    webRootUrl: "platformtest.omnihive.io",
                },
                constants: {},
                features: {},
                workers: settings.workers,
            };

            assert.doesNotThrow(async () => await OmniHiveClient.getSingleton().init(serverSettings));
        });

        it("init - no settings", async function () {
            assert.doesNotThrow(async () => await OmniHiveClient.getSingleton().init());
        });
    });

    describe("graph tests", function () {});

    describe("auth token tests", function () {
        it("set auth token", async function () {
            OmniHiveClient.getSingleton().setAccessToken(settings.constants["testAuthToken"]);
            assert.equal(OmniHiveClient.getSingleton().accessToken, settings.constants["testAuthToken"]);
        });
    });
});
