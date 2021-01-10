import { assert } from 'chai';
import { serializeError } from 'serialize-error';
import { StringBuilder } from '../helpers/StringBuilder';

describe("StringBuilder Tests", function () {
    const testString = "Test Sting Here";

    it("new string builder", function () {
        try {
            const builder = new StringBuilder(testString);

            assert.equal(builder.outputString(), testString);
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    });

    it("append", function () {
        try {
            const builder = new StringBuilder(testString);
            builder.append(` ${testString}`);

            assert.equal(builder.outputString(), `${testString} ${testString}`);
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    });

    it("append no args", function () {
        try {
            const builder = new StringBuilder(testString);
            builder.append();

            assert.equal(builder.outputString(), `${testString}`);
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    });

    it("appendLine", function () {
        try {
            const builder = new StringBuilder(testString);
            builder.appendLine(` ${testString}`);

            assert.equal(builder.outputString(), `${testString} ${testString}\r\n`);
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    });

    it("appendLine no args", function () {
        try {
            const builder = new StringBuilder(testString);
            builder.appendLine();

            assert.equal(builder.outputString(), `${testString}\r\n`);
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    });

    it("clear", function () {
        try {
            const builder = new StringBuilder(testString);
            builder.clear();

            assert.equal(builder.outputString(), ``);
        } catch (err) {
            throw new Error(JSON.stringify(serializeError(err)));
        }
    });
});