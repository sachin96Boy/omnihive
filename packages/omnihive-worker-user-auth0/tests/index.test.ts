import AuthZeroUserWorker from '..';
import { assert } from 'chai';
import fs from 'fs';
import { serializeError } from 'serialize-error';
import { CommonStore } from "@withonevision/omnihive-common/stores/CommonStore";
import { AwaitHelper } from "@withonevision/omnihive-common/helpers/AwaitHelper";
import { HiveWorkerType } from "@withonevision/omnihive-common/enums/HiveWorkerType";
import { AuthUser } from "@withonevision/omnihive-common/models/AuthUser";
import { ObjectHelper } from "@withonevision/omnihive-common/helpers/ObjectHelper";
import { ServerSettings } from "@withonevision/omnihive-common/models/ServerSettings";

const getConfig = function (): ServerSettings | undefined {
    try {
        if (!process.env.OH_SETTINGS_FILE) {
            return undefined;
        }

        return ObjectHelper.createStrict(ServerSettings, JSON.parse(
            fs.readFileSync(`${process.env.OH_SETTINGS_FILE}`,
                { encoding: "utf8" })));
    } catch {
        return undefined;
    }
}

let settings: ServerSettings;
let worker: AuthZeroUserWorker = new AuthZeroUserWorker();

describe('user worker tests', function () {

    before(function () {
        const config: ServerSettings | undefined = getConfig();

        if (!config) {
            this.skip();
        }

        CommonStore.getInstance().clearWorkers();
        settings = config;
    });

    const init = async function (): Promise<void> {
        try {
            await AwaitHelper.execute(CommonStore.getInstance()
                .initWorkers(settings.workers));
            const newWorker = CommonStore
                .getInstance()
                .workers
                .find((x) => x[0].type === HiveWorkerType.User);

            if (newWorker && newWorker[1]) {
                worker = newWorker[1];
            }
        } catch (err) {
            throw new Error("init failure: " + serializeError(JSON.stringify(err)));
        }
    }

    describe("Init functions", function () {
        it('test init', async function () {
            const result = await init();
            assert.isUndefined(result);
        });
    });


    describe("Worker Functions", function () {
        before(async function () {
            await init();
        });

        const validateStartCondition = async function (createTest: boolean = false): Promise<void> {

            const userId: string | undefined = await worker.getUserIdByEmail("test1@withone.vision");

            if (createTest && userId) {
                await worker.delete(userId);
            } else if (!createTest && !userId) {
                try {
                    await AwaitHelper
                        .execute<AuthUser>(worker
                            .create("test1@withone.vision", "$r0ngPa$$w0rd"));
                } catch (err) {
                    throw new Error("create failure: " + serializeError(JSON.stringify(err)));
                }
            }
        }

        const validateResults = function (account: AuthUser) {
            if (account) {
                const validate: any = account?.email

                assert.strictEqual(validate, "test1@withone.vision");
            } else {
                throw new Error("Validation Failed");
            }

            return account;
        }

        it("Create User", async function () {

            await validateStartCondition(true);

            let account: AuthUser;

            try {
                account = await AwaitHelper
                    .execute<AuthUser>(
                        worker.create("test1@withone.vision", "$r0ngPa$$w0rd")
                    );
            } catch (err) {
                throw new Error("create failure: " + serializeError(JSON.stringify(err)));
            }

            validateResults(account);
        });

        it("Get User", async function () {
            await validateStartCondition();

            let account: AuthUser;

            try {
                account = await AwaitHelper
                    .execute<AuthUser>(
                        worker.get("test1@withone.vision")
                    );
            } catch (err) {
                throw new Error("get failure: " + serializeError(JSON.stringify(err)));
            }

            validateResults(account);
        });

        it("Login User", async function () {
            await validateStartCondition();

            let account: AuthUser;

            try {
                account = await AwaitHelper
                    .execute<AuthUser>(
                        worker.login("test1@withone.vision", "$r0ngPa$$w0rd")
                    );
            } catch (err) {
                throw new Error("login failure: " + serializeError(JSON.stringify(err)));
            }

            validateResults(account);
        });

        it("Password Change Request", async function () {
            await validateStartCondition();

            let results: boolean = false;

            try {
                results = await AwaitHelper.execute<boolean>(
                    worker.passwordChangeRequest("test1@withone.vision")
                );
            } catch (err) {
                throw new Error("password change request failure: " + serializeError(JSON.stringify(err)));
            }

            assert.isOk(results);
        });

        it("Update User", async function () {
            await validateStartCondition();

            let account: AuthUser;
            const updateUser: AuthUser = new AuthUser();
            updateUser.firstName = "Awesome";
            updateUser.lastName = "Tester";
            updateUser.nickname = "Unstoppable";
            updateUser.fullName = "Unstoppable Tester";

            try {
                account = await AwaitHelper.execute<AuthUser>(
                    worker.update("test1@withone.vision", updateUser)
                );
            } catch (err) {
                throw new Error("update failure: " + serializeError(JSON.stringify(err)));
            }

            assert.deepEqual(account, updateUser);
        });

        it("Get UserId By Email", async function () {
            await validateStartCondition();

            let results: string | undefined;

            try {
                results = await AwaitHelper.execute<string | undefined>(
                    worker.getUserIdByEmail("test1@withone.vision")
                );
            } catch (err) {
                throw new Error("get userId by email failure: " + serializeError(JSON.stringify(err)));
            }

            assert.isOk(results);
        })

        it("Delete User", async function () {
            await validateStartCondition();

            let results: string = "";

            try {
                const id: string | undefined = await AwaitHelper.execute<string | undefined>(
                    worker.getUserIdByEmail("test1@withone.vision")
                );

                if (id) {
                    results = await AwaitHelper.execute<string>(
                        worker.delete(id)
                    );
                }
            } catch (err) {
                throw new Error("update failure: " + serializeError(JSON.stringify(err)));
            }

            assert.strictEqual(results, "User successfully deleted");
        })
    });
})