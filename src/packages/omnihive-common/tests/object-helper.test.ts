import { assert } from "chai";
import { serializeError } from "serialize-error";
import { ObjectHelper } from "../helpers/ObjectHelper";
import { HiveWorker } from "../models/HiveWorker";

describe("ObjectHelper Tests", function () {
    const testObject = "Test Object";

    it("create object", function () {
        try {
            const model = {
                name: testObject,
            };
            const obj = ObjectHelper.create<HiveWorker>(HiveWorker, model);

            const comparer = Object.keys(new HiveWorker());
            const objKeys = Object.keys(obj);

            assert.deepEqual(objKeys, comparer);
            assert.deepEqual(obj.name, testObject);
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    });

    it("create object generic", function () {
        const obj = ObjectHelper.create<HiveWorker>(HiveWorker, null);

        const comparer = Object.keys(new HiveWorker());
        const objKeys = Object.keys(obj);

        assert.deepEqual(objKeys, comparer);
        assert.deepEqual(obj.name, "");
    });

    it("create object strict", function () {
        try {
            const model = {
                name: testObject,
            };
            const obj = ObjectHelper.createStrict<HiveWorker>(HiveWorker, model);

            const comparer = Object.keys(new HiveWorker());
            const objKeys = Object.keys(obj);

            assert.deepEqual(objKeys, comparer);
            assert.deepEqual(obj.name, testObject);
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    });

    it("create object strict no model", function () {
        try {
            ObjectHelper.createStrict<HiveWorker>(HiveWorker, null);

            assert.fail("Strict can not create without a model");
        } catch (err) {
            assert.equal(err.message, `Model cannot be null or undefined in strict mode.`);
        }
    });

    it("create object strict bad property", function () {
        try {
            const model = {
                fakeProperty: testObject,
            };
            ObjectHelper.createStrict<HiveWorker>(HiveWorker, model);

            assert.fail("Strict can not create with a bad property");
        } catch (err) {
            assert.equal(err.message, `Property fakeProperty does not exist on target generic type.`);
        }
    });

    it("create array object", function () {
        try {
            const model = {
                name: testObject,
            };
            const obj = ObjectHelper.createArray<HiveWorker>(HiveWorker, [model, model]);

            const comparer = Object.keys(new HiveWorker());
            const obj0Keys = Object.keys(obj[0]);
            const obj1Keys = Object.keys(obj[1]);

            assert.deepEqual(obj0Keys, comparer);
            assert.deepEqual(obj1Keys, comparer);
            assert.equal(obj.length, 2);
            assert.deepEqual(
                obj.map((x: HiveWorker) => x.name),
                [testObject, testObject]
            );
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    });

    it("create object array strict", function () {
        try {
            const model = {
                name: testObject,
            };
            const obj = ObjectHelper.createArrayStrict<HiveWorker>(HiveWorker, [model, model]);

            const comparer = Object.keys(new HiveWorker());
            const obj0Keys = Object.keys(obj[0]);
            const obj1Keys = Object.keys(obj[1]);

            assert.deepEqual(obj0Keys, comparer);
            assert.deepEqual(obj1Keys, comparer);
            assert.equal(obj.length, 2);
            assert.deepEqual(
                obj.map((x: HiveWorker) => x.name),
                [testObject, testObject]
            );
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    });

    it("create object array strict no model", function () {
        try {
            ObjectHelper.createStrict<HiveWorker>(HiveWorker, null);

            assert.fail("Strict can not create without a model");
        } catch (err) {
            assert.equal(err.message, `Model cannot be null or undefined in strict mode.`);
        }
    });

    it("create object array strict bad property", function () {
        try {
            const model = {
                fakeProperty: testObject,
            };
            ObjectHelper.createArrayStrict<HiveWorker>(HiveWorker, [model, model]);

            assert.fail("Strict can not create with a bad property");
        } catch (err) {
            assert.equal(err.message, `Property fakeProperty does not exist on target generic type.`);
        }
    });
});
