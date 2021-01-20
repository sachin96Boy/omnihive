import { assert } from "chai";
import { serializeError } from "serialize-error";
import { StringHelper } from "../helpers/StringHelper";

describe("StringHelper Tests", function () {
    it("isNullOrWhiteSpace empty string", function () {
        try {
            assert.equal(StringHelper.isNullOrWhiteSpace(""), true);
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    });

    it("isNullOrWhiteSpace null string", function () {
        try {
            assert.equal(StringHelper.isNullOrWhiteSpace("null"), true);
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    });

    it("isNullOrWhiteSpace undefined string", function () {
        try {
            assert.equal(StringHelper.isNullOrWhiteSpace("undefined"), true);
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    });

    it("isNullOrWhiteSpace spaces only", function () {
        try {
            assert.equal(StringHelper.isNullOrWhiteSpace("    "), true);
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    });

    it("isNullOrWhiteSpace bad arg", function () {
        try {
            const badArg: any = undefined;
            assert.equal(StringHelper.isNullOrWhiteSpace(badArg), true);
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    });

    it("isNullOrWhiteSpace real texts", function () {
        try {
            assert.equal(StringHelper.isNullOrWhiteSpace("This is real text"), false);
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    });

    it("capitalizeFirstLetter", function () {
        try {
            assert.equal(StringHelper.capitalizeFirstLetter("first name"), "First name");
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    });
});
