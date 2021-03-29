import { ServerSettings } from "@withonevision/omnihive-core/models/ServerSettings";
import { expect } from "chai";
import LocalFeatureWorker from "..";

const mockServerSettings: ServerSettings = {
    features: { mockFeature: "mockFeatureValue" },
    constants: {},
    config: {
        adminPassword: "mockPassword",
        adminPortNumber: 9999,
        nodePortNumber: 9999,
        webRootUrl: "mockUrl",
    },
    workers: [],
};

const worker = new LocalFeatureWorker();
worker.serverSettings = mockServerSettings;

describe("local feature worker tests", () => {
    describe("worker functions", () => {
        it("get", async () => {
            const result = await worker.get("mockFeature");
            expect(result).to.eq("mockFeatureValue");
        });
        it("get - no name", async () => {
            try {
                await worker.get("");
                throw new Error("Method expected to fail, but didn't");
            } catch (err) {
                expect(err).to.be.an("error").with.property("message", "No feature name given.");
            }
        });
        it("get - default value", async () => {
            const result = await worker.get("nonexistentFeature", "defaultValue");
            expect(result).to.eq("defaultValue");
        });
        it("get - does not exist", async () => {
            const result = await worker.get("nonexistentFeature");
            expect(result).to.be.undefined;
        });
    });
});
