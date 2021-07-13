import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { expect } from "chai";
import path from "path";
import FileSystemWorker from "..";
import faker from "faker";
import fse from "fs-extra";

class TestSetup {
    public worker: FileSystemWorker = new FileSystemWorker();
    public workerName: string = "testFilesystemFsExtra";

    public dirnamePath: string = __dirname;
    public workDirectoryPath: string = path.join(this.dirnamePath, "work-directory");
    public copyDirectoryPath: string = path.join(this.dirnamePath, "work-copy-folder");
    public testJsonFileName: string = `${faker.system.fileName()}.json`;
    public testJsonFilePath = path.join(this.workDirectoryPath, this.testJsonFileName);

    public testData: string = JSON.parse(faker.datatype.json());
}

const testSetup = new TestSetup();

describe("Worker Test - File - FSExtra", () => {
    describe("Init Functions", () => {
        it("Test Init", async () => {
            await AwaitHelper.execute(testSetup.worker.init(testSetup.workerName));
        });
    });

    describe("Worker Functions", () => {
        beforeEach(() => {
            fse.ensureDirSync(testSetup.copyDirectoryPath);
            fse.emptyDirSync(testSetup.copyDirectoryPath);

            fse.ensureDirSync(testSetup.workDirectoryPath);
            fse.emptyDirSync(testSetup.workDirectoryPath);

            fse.writeFileSync(testSetup.testJsonFilePath, JSON.stringify(testSetup.testData), { encoding: "utf8" });
        });

        afterEach(() => {
            if (fse.existsSync(testSetup.workDirectoryPath)) {
                if (fse.readdirSync(testSetup.workDirectoryPath).length > 0) {
                    fse.emptyDirSync(testSetup.workDirectoryPath);
                }

                fse.rmdirSync(testSetup.workDirectoryPath);
            }

            if (fse.existsSync(testSetup.copyDirectoryPath)) {
                if (fse.readdirSync(testSetup.copyDirectoryPath).length > 0) {
                    fse.emptyDirSync(testSetup.copyDirectoryPath);
                }

                fse.rmdirSync(testSetup.copyDirectoryPath);
            }
        });

        after(() => {
            if (fse.pathExistsSync(testSetup.copyDirectoryPath)) {
                fse.rmdirSync(testSetup.copyDirectoryPath);
            }

            if (fse.pathExistsSync(testSetup.workDirectoryPath)) {
                fse.rmdirSync(testSetup.workDirectoryPath);
            }
        });

        it("Directory Has Files", () => {
            const results: boolean = testSetup.worker.directoryHasFiles("./");
            expect(results).to.be.true;
        });

        it("Read Files From Directory", () => {
            const results: string[] = testSetup.worker.readFileNamesFromDirectory(testSetup.workDirectoryPath);
            expect(results).to.deep.equal([testSetup.testJsonFileName]);
        });

        it("Read File", () => {
            const fileContents: string = testSetup.worker.readFile(testSetup.testJsonFilePath);
            expect(fileContents).to.equal(JSON.stringify(testSetup.testData));
        });

        it("Ensure Folder Exists", () => {
            testSetup.worker.ensureFolderExists(testSetup.workDirectoryPath);
            const result: boolean = testSetup.worker.pathExists(testSetup.workDirectoryPath);
            expect(result).to.be.true;
        });

        it("Remove File", () => {
            testSetup.worker.removeFile(testSetup.testJsonFilePath);
            const result: string[] = testSetup.worker.readFileNamesFromDirectory(testSetup.workDirectoryPath);
            expect(result).to.deep.equal([]);
        });

        it("Remove Files In Directory", () => {
            testSetup.worker.removeFilesFromDirectory(testSetup.workDirectoryPath);
            const result: string[] = testSetup.worker.readFileNamesFromDirectory(testSetup.workDirectoryPath);
            expect(result).to.deep.equal([]);
        });

        it("Remove Directory", () => {
            testSetup.worker.removeDirectory(testSetup.workDirectoryPath);
            const result: boolean = testSetup.worker.pathExists(testSetup.workDirectoryPath);
            expect(result).to.be.false;
        });

        it("Write Data To File", () => {
            const testPath: string = path.join(testSetup.workDirectoryPath, `${faker.system.fileName()}.txt`);
            const testData: string = faker.lorem.paragraphs();
            testSetup.worker.writeDataToFile(testPath, testData);

            // Verify file creation
            const exists: boolean = testSetup.worker.pathExists(testPath);
            expect(exists).to.be.true;

            // Verify file content
            const result: string = testSetup.worker.readFile(testPath);
            expect(result).to.deep.equal(testData);
        });

        it("Write JSON To File", () => {
            const testPath: string = path.join(testSetup.workDirectoryPath, `${faker.system.fileName()}.json`);
            testSetup.worker.writeJsonToFile(testPath, testSetup.testData);

            // Verify file creation
            const exists: boolean = testSetup.worker.pathExists(testPath);
            expect(exists).to.be.true;

            // Verify file content
            const fileContents: string = testSetup.worker.readFile(testPath);
            expect(fileContents).to.equal(JSON.stringify(testSetup.testData));
        });

        it("Copy File", () => {
            const sourcePath: string = path.join(testSetup.workDirectoryPath, `${faker.system.fileName()}.json`);
            const sourceData: string = JSON.parse(faker.datatype.json());
            testSetup.worker.writeJsonToFile(sourcePath, sourceData);

            const destPath: string = path.join(testSetup.copyDirectoryPath, `${faker.system.fileName()}.json`);
            testSetup.worker.copyFile(sourcePath, destPath);

            const result: boolean = testSetup.worker.pathExists(destPath);
            expect(result).to.be.true;
        });

        it("Copy Directory", () => {
            const sourceFiles: string[] = testSetup.worker.readFileNamesFromDirectory(testSetup.workDirectoryPath);
            const destPath: string = path.join(testSetup.copyDirectoryPath);
            testSetup.worker.copyDirectory(testSetup.workDirectoryPath, destPath);

            const result: string[] = testSetup.worker.readFileNamesFromDirectory(destPath);
            expect(result).to.deep.equal(sourceFiles);
        });
    });
});
