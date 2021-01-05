import { assert } from 'chai';
import { serializeError } from 'serialize-error';
import { ObjectHelper } from '../helpers/ObjectHelper';
import { Drone } from '../models/Drone';

describe("ObjectHelper Tests", function () {
    const testObject = "Test Object";

    it("create object", function () {
        try {
            const model = {
                name: testObject,
            }
            const obj = ObjectHelper.create<Drone>(Drone, model);

            const comparer = Object.keys(new Drone());
            const objKeys = Object.keys(obj);

            assert.deepEqual(objKeys, comparer);
            assert.deepEqual(obj.name, testObject);
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    });

    it("create object generic", function () {

        const obj = ObjectHelper.create<Drone>(Drone, null);

        const comparer = Object.keys(new Drone());
        const objKeys = Object.keys(obj);

        assert.deepEqual(objKeys, comparer);
        assert.deepEqual(obj.name, "");
    });

    it("create object strict", function () {
        try {
            const model = {
                name: testObject,
            }
            const obj = ObjectHelper.createStrict<Drone>(Drone, model);

            const comparer = Object.keys(new Drone());
            const objKeys = Object.keys(obj);

            assert.deepEqual(objKeys, comparer);
            assert.deepEqual(obj.name, testObject);
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    });

    it("create object strict no model", function () {
        try {
            ObjectHelper.createStrict<Drone>(Drone, null);

            assert.fail("Strict can not create without a model");
        } catch (err) {
            assert.equal(err.message, `Model cannot be null or undefined in strict mode.`);
        }
    });

    it("create object strict bad property", function () {
        try {
            const model = {
                fakeProperty: testObject,
            }
            ObjectHelper.createStrict<Drone>(Drone, model);

            assert.fail("Strict can not create with a bad property");
        } catch (err) {
            assert.equal(err.message, `Property fakeProperty does not exist on target generic type.`);
        }
    });

    it("create array object", function () {
        try {
            const model = {
                name: testObject,
            }
            const obj = ObjectHelper.createArray<Drone>(Drone, [model, model]);

            const comparer = Object.keys(new Drone());
            const obj0Keys = Object.keys(obj[0]);
            const obj1Keys = Object.keys(obj[1]);

            assert.deepEqual(obj0Keys, comparer);
            assert.deepEqual(obj1Keys, comparer);
            assert.equal(obj.length, 2);
            assert.deepEqual(obj.map((x: Drone) => x.name), [testObject, testObject]);
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    });

    it("create object array strict", function () {
        try {
            const model = {
                name: testObject,
            }
            const obj = ObjectHelper.createArrayStrict<Drone>(Drone, [model, model]);

            const comparer = Object.keys(new Drone());
            const obj0Keys = Object.keys(obj[0]);
            const obj1Keys = Object.keys(obj[1]);

            assert.deepEqual(obj0Keys, comparer);
            assert.deepEqual(obj1Keys, comparer);
            assert.equal(obj.length, 2);
            assert.deepEqual(obj.map((x: Drone) => x.name), [testObject, testObject]);
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    });

    it("create object array strict no model", function () {
        try {
            ObjectHelper.createStrict<Drone>(Drone, null);

            assert.fail("Strict can not create without a model");
        } catch (err) {
            assert.equal(err.message, `Model cannot be null or undefined in strict mode.`);
        }
    });

    it("create object array strict bad property", function () {
        try {
            const model = {
                fakeProperty: testObject,
            }
            ObjectHelper.createArrayStrict<Drone>(Drone, [model, model]);

            assert.fail("Strict can not create with a bad property");
        } catch (err) {
            assert.equal(err.message, `Property fakeProperty does not exist on target generic type.`);
        }
    });
});