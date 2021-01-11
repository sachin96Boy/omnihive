import FileSystemWorker from '..';
import { assert } from 'chai';
import fs from 'fs';
import path from 'path';
import { serializeError } from 'serialize-error';
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import { HiveWorkerType } from "@withonevision/omnihive-queen/enums/HiveWorkerType";
import { AwaitHelper } from "@withonevision/omnihive-queen/helpers/AwaitHelper";
import { QueenStore } from "@withonevision/omnihive-queen/stores/QueenStore";

const getConfigs = function (): any | undefined {
    try {
        if (!process.env.OH_ENV_FILE) {
            return undefined;
        }

        dotenvExpand(dotenv.config({ path: process.env.OH_ENV_FILE }));

        return JSON.parse(fs.readFileSync(`${process.env.OH_TEST_WORKER_FILESYSTEM_FSEXTRA}`,
            { encoding: "utf8" }));
    } catch {
        return undefined;
    }
}


let worker: FileSystemWorker = new FileSystemWorker();
let configs: any | undefined;

describe('file system worker tests', function () {

    before(function () {
        configs = getConfigs();

        if (!configs) {
            this.skip();
        }
    });

    const init = async function (): Promise<void> {
        try {
            await AwaitHelper.execute(QueenStore.getInstance()
                .initWorkers(configs));
            const newWorker = QueenStore
                .getInstance()
                .workers
                .find((x) => x[0].type === HiveWorkerType.FileSystem);

            if (newWorker && newWorker[1]) {
                worker = newWorker[1];
            }
        } catch (err) {
            throw new Error("init failure: " + serializeError(JSON.stringify(err)));
        }
    }

    describe("Init functions", function () {
        it('test init', async function () {
            const result = await AwaitHelper.execute<void>(init());
            assert.isUndefined(result);
        });
    });


    describe("Worker Functions", function () {
        before(async function () {
            await init();
        });

        let fileDirPath: string = "";
        let fileExePath: string = "";
        let testFolderPath: string = "";

        beforeEach(function () {
            fileDirPath = worker.getCurrentFileDirectory();
            fileExePath = worker.getCurrentExecutionDirectory();

            testFolderPath = path.join(fileDirPath, "tests", "testing-folder");

            worker.ensureFolderExists(testFolderPath);

            worker.removeFilesFromDirectory(testFolderPath);

            const testData: any = {
                data: "This test will be awesome!",
            };
            worker.writeJsonToFile(path.join(testFolderPath, "test-file.json"), testData);
        });

        afterEach(function() {
            worker.removeDirectory(testFolderPath);
            worker.removeDirectory(path.join(fileDirPath, "test-copy-directory"));
        });

        it("Get current directory", function () {
            const path: string = worker.getCurrentFileDirectory();
            assert.isTrue(path.includes("packages/omnihive-worker-filesystem-fsextra"));
            assert.equal(path, fileDirPath);
        });

        it("Get execution directory", function () {
            const path: string = worker.getCurrentExecutionDirectory();
            assert.equal(path, fileExePath);
        });

        it("Directory has files", function () {
            const results: boolean = worker.directoryHasFiles("./");
            assert.isTrue(results);
        });

        it("Read files from directory", function () {
            const results: string[] = worker.readFileNamesFromDirectory(testFolderPath);
            assert.deepEqual(results, [
                "test-file.json"
            ]);
        });

        it("Read file", function() {
            const rawResult: string = worker.readFile(path.join(testFolderPath, "test-file.json"));
            const results: any = JSON.parse(rawResult);
            assert.equal(results.data, "This test will be awesome!");
        });

        it("Ensure folder exists", function () {
            try {
                worker.ensureFolderExists(testFolderPath);
                const result: boolean = worker.pathExists(testFolderPath);
                assert.isTrue(result);
            } catch (err) {
                throw new Error("Ensure Folder Exists Error => " + JSON.stringify(serializeError(err)));
            }
        });

        it("Remove file", function() {
            worker.removeFile(path.join(testFolderPath,"test-file.json"));
            const result: string[] = worker.readFileNamesFromDirectory(testFolderPath);
            assert.deepEqual(result, []);
        });

        it("Remove files in directory", function() {
            worker.removeFilesFromDirectory(testFolderPath);
            const result: string[] = worker.readFileNamesFromDirectory(testFolderPath);
            assert.deepEqual(result, []);
        });

        it("Remove directory", function() {
            worker.removeDirectory(testFolderPath);
            const result: boolean = worker.pathExists(testFolderPath);
            assert.isFalse(result);
        });

        it("Write data to file", function() {
            const singlePath: string = path.join(testFolderPath, "write-data-test.text");
            const data: string = "Write this string to a file please!"
            worker.writeDataToFile(singlePath, data);

            // Verify file creation
            const exists: boolean = worker.pathExists(singlePath);
            assert.isTrue(exists);

            // Verify file content
            const result: string = worker.readFile(singlePath);
            assert.deepEqual(result, data);
        });

        it("Write data to file", function() {
            const singlePath: string = path.join(testFolderPath, "write-data-test.json");
            const testingString: string = "This will be yet another awesome test!!";
            const data: any = {
                data: testingString,
            };
            worker.writeJsonToFile(singlePath, data);

            // Verify file creation
            const exists: boolean = worker.pathExists(singlePath);
            assert.isTrue(exists);

            // Verify file content
            const rawResult: string = worker.readFile(singlePath);
            const results: any = JSON.parse(rawResult);
            assert.equal(results.data, testingString);
        });

        it("Copy File", function() {
            const source: string = path.join(testFolderPath, "test-file.json");
            const dest: string = path.join(testFolderPath, "test-copy-file.json");
            worker.copyFile(source, dest);

            const result: boolean = worker.pathExists(dest);
            assert.isTrue(result);
        });

        it("Copy Directory", function() {
            const sourceFiles: string[] = worker.readFileNamesFromDirectory(testFolderPath);
            const dest: string = path.join(fileDirPath, "test-copy-directory");
            worker.copyDirectory(testFolderPath, dest);

            const result: string[] = worker.readFileNamesFromDirectory(dest);
            assert.deepEqual(result, sourceFiles);
        });
    });
})