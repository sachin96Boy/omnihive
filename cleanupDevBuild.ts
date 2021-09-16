import path from "path";
import rimraf from "rimraf";
import fse from "fs-extra";

const clean = () => {
    rimraf(path.join(".", "**", "*.tsbuildinfo"), () => {});
    rimraf(path.join(".", "src", "common", "omnihive-client", "**", "*.tsbuildinfo"), () => {});
    rimraf(path.join(".", "src", "common", "omnihive-core", "**", "*.tsbuildinfo"), () => {});
    rimraf(path.join(".", "src", "common", "omnihive-desktop-core", "**", "*.tsbuildinfo"), () => {});

    fse.unlink(path.join(".", "src", "common", "omnihive-client", "index.d.ts"), () => {});
    fse.unlink(path.join(".", "src", "common", "omnihive-client", "index.d.ts.map"), () => {});
    fse.unlink(path.join(".", "src", "common", "omnihive-client", "index.js"), () => {});
    fse.unlink(path.join(".", "src", "common", "omnihive-client", "index.js.map"), () => {});
    rimraf(path.join(".", "src", "common", "omnihive-client", "index.d.ts"), () => {});
    rimraf(path.join(".", "src", "common", "omnihive-client", "index.d.ts.map"), () => {});
    rimraf(path.join(".", "src", "common", "omnihive-client", "index.js"), () => {});
    rimraf(path.join(".", "src", "common", "omnihive-client", "index.js.map"), () => {});

    rimraf(path.join(".", "src", "common", "omnihive-core", "enums", "**", "*.d.ts"), () => {});
    rimraf(path.join(".", "src", "common", "omnihive-core", "enums", "**", "*.d.ts.map"), () => {});
    rimraf(path.join(".", "src", "common", "omnihive-core", "enums", "**", "*.js"), () => {});
    rimraf(path.join(".", "src", "common", "omnihive-core", "enums", "**", "*.js.map"), () => {});

    rimraf(path.join(".", "src", "common", "omnihive-core", "helpers", "**", "*.d.ts"), () => {});
    rimraf(path.join(".", "src", "common", "omnihive-core", "helpers", "**", "*.d.ts.map"), () => {});
    rimraf(path.join(".", "src", "common", "omnihive-core", "helpers", "**", "*.js"), () => {});
    rimraf(path.join(".", "src", "common", "omnihive-core", "helpers", "**", "*.js.map"), () => {});

    rimraf(path.join(".", "src", "common", "omnihive-core", "interfaces", "**", "*.d.ts"), () => {});
    rimraf(path.join(".", "src", "common", "omnihive-core", "interfaces", "**", "*.d.ts.map"), () => {});
    rimraf(path.join(".", "src", "common", "omnihive-core", "interfaces", "**", "*.js"), () => {});
    rimraf(path.join(".", "src", "common", "omnihive-core", "interfaces", "**", "*.js.map"), () => {});

    rimraf(path.join(".", "src", "common", "omnihive-core", "models", "**", "*.d.ts"), () => {});
    rimraf(path.join(".", "src", "common", "omnihive-core", "models", "**", "*.d.ts.map"), () => {});
    rimraf(path.join(".", "src", "common", "omnihive-core", "models", "**", "*.js"), () => {});
    rimraf(path.join(".", "src", "common", "omnihive-core", "models", "**", "*.js.map"), () => {});

    rimraf(path.join(".", "src", "common", "omnihive-desktop-core", "components", "**", "*.d.ts"), () => {});
    rimraf(path.join(".", "src", "common", "omnihive-desktop-core", "components", "**", "*.d.ts.map"), () => {});
    rimraf(path.join(".", "src", "common", "omnihive-desktop-core", "components", "**", "*.js"), () => {});
    rimraf(path.join(".", "src", "common", "omnihive-desktop-core", "components", "**", "*.js.map"), () => {});

    rimraf(path.join(".", "src", "common", "omnihive-desktop-core", "hooks", "**", "*.d.ts"), () => {});
    rimraf(path.join(".", "src", "common", "omnihive-desktop-core", "hooks", "**", "*.d.ts.map"), () => {});
    rimraf(path.join(".", "src", "common", "omnihive-desktop-core", "hooks", "**", "*.js"), () => {});
    rimraf(path.join(".", "src", "common", "omnihive-desktop-core", "hooks", "**", "*.js.map"), () => {});

    rimraf(path.join(".", "src", "common", "omnihive-desktop-core", "models", "**", "*.d.ts"), () => {});
    rimraf(path.join(".", "src", "common", "omnihive-desktop-core", "models", "**", "*.d.ts.map"), () => {});
    rimraf(path.join(".", "src", "common", "omnihive-desktop-core", "models", "**", "*.js"), () => {});
    rimraf(path.join(".", "src", "common", "omnihive-desktop-core", "models", "**", "*.js.map"), () => {});
};

clean();
