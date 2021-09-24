import path from "path";
import rimraf from "rimraf";
import fse from "fs-extra";

const clean = () => {
    rimraf(path.join("..", "**", "*.tsbuildinfo"), () => {});

    rimraf(path.join("..", "src", "common", "omnihive-core", "**", "*.tsbuildinfo"), () => {});

    rimraf(path.join("..", "src", "common", "omnihive-core", "client", "**", "*.d.ts"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core", "client", "**", "*.d.ts.map"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core", "client", "**", "*.js"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core", "client", "**", "*.js.map"), () => {});

    rimraf(path.join("..", "src", "common", "omnihive-core", "enums", "**", "*.d.ts"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core", "enums", "**", "*.d.ts.map"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core", "enums", "**", "*.js"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core", "enums", "**", "*.js.map"), () => {});

    rimraf(path.join("..", "src", "common", "omnihive-core", "helpers", "**", "*.d.ts"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core", "helpers", "**", "*.d.ts.map"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core", "helpers", "**", "*.js"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core", "helpers", "**", "*.js.map"), () => {});

    rimraf(path.join("..", "src", "common", "omnihive-core", "interfaces", "**", "*.d.ts"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core", "interfaces", "**", "*.d.ts.map"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core", "interfaces", "**", "*.js"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core", "interfaces", "**", "*.js.map"), () => {});

    rimraf(path.join("..", "src", "common", "omnihive-core", "models", "**", "*.d.ts"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core", "models", "**", "*.d.ts.map"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core", "models", "**", "*.js"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core", "models", "**", "*.js.map"), () => {});

    fse.unlink(path.join("..", "src", "common", "omnihive-core", "index.d.ts"), () => {});
    fse.unlink(path.join("..", "src", "common", "omnihive-core", "index.d.ts.map"), () => {});
    fse.unlink(path.join("..", "src", "common", "omnihive-core", "index.js"), () => {});
    fse.unlink(path.join("..", "src", "common", "omnihive-core", "index.js.map"), () => {});

    rimraf(path.join("..", "src", "common", "omnihive-core-cjs", "**", "*.tsbuildinfo"), () => {});

    rimraf(path.join("..", "src", "common", "omnihive-core-cjs", "client", "**", "*.d.ts"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core-cjs", "client", "**", "*.d.ts.map"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core-cjs", "client", "**", "*.js"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core-cjs", "client", "**", "*.js.map"), () => {});

    rimraf(path.join("..", "src", "common", "omnihive-core-cjs", "enums", "**", "*.d.ts"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core-cjs", "enums", "**", "*.d.ts.map"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core-cjs", "enums", "**", "*.js"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core-cjs", "enums", "**", "*.js.map"), () => {});

    rimraf(path.join("..", "src", "common", "omnihive-core-cjs", "helpers", "**", "*.d.ts"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core-cjs", "helpers", "**", "*.d.ts.map"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core-cjs", "helpers", "**", "*.js"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core-cjs", "helpers", "**", "*.js.map"), () => {});

    rimraf(path.join("..", "src", "common", "omnihive-core-cjs", "interfaces", "**", "*.d.ts"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core-cjs", "interfaces", "**", "*.d.ts.map"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core-cjs", "interfaces", "**", "*.js"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core-cjs", "interfaces", "**", "*.js.map"), () => {});

    rimraf(path.join("..", "src", "common", "omnihive-core-cjs", "models", "**", "*.d.ts"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core-cjs", "models", "**", "*.d.ts.map"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core-cjs", "models", "**", "*.js"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core-cjs", "models", "**", "*.js.map"), () => {});

    fse.unlink(path.join("..", "src", "common", "omnihive-core-cjs", "index.d.ts"), () => {});
    fse.unlink(path.join("..", "src", "common", "omnihive-core-cjs", "index.d.ts.map"), () => {});
    fse.unlink(path.join("..", "src", "common", "omnihive-core-cjs", "index.js"), () => {});
    fse.unlink(path.join("..", "src", "common", "omnihive-core-cjs", "index.js.map"), () => {});

    rimraf(path.join("..", "src", "common", "omnihive-core-esm", "**", "*.tsbuildinfo"), () => {});

    rimraf(path.join("..", "src", "common", "omnihive-core-esm", "client", "**", "*.d.ts"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core-esm", "client", "**", "*.d.ts.map"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core-esm", "client", "**", "*.js"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core-esm", "client", "**", "*.js.map"), () => {});

    rimraf(path.join("..", "src", "common", "omnihive-core-esm", "enums", "**", "*.d.ts"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core-esm", "enums", "**", "*.d.ts.map"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core-esm", "enums", "**", "*.js"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core-esm", "enums", "**", "*.js.map"), () => {});

    rimraf(path.join("..", "src", "common", "omnihive-core-esm", "helpers", "**", "*.d.ts"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core-esm", "helpers", "**", "*.d.ts.map"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core-esm", "helpers", "**", "*.js"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core-esm", "helpers", "**", "*.js.map"), () => {});

    rimraf(path.join("..", "src", "common", "omnihive-core-esm", "interfaces", "**", "*.d.ts"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core-esm", "interfaces", "**", "*.d.ts.map"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core-esm", "interfaces", "**", "*.js"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core-esm", "interfaces", "**", "*.js.map"), () => {});

    rimraf(path.join("..", "src", "common", "omnihive-core-esm", "models", "**", "*.d.ts"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core-esm", "models", "**", "*.d.ts.map"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core-esm", "models", "**", "*.js"), () => {});
    rimraf(path.join("..", "src", "common", "omnihive-core-esm", "models", "**", "*.js.map"), () => {});

    fse.unlink(path.join("..", "src", "common", "omnihive-core-esm", "index.d.ts"), () => {});
    fse.unlink(path.join("..", "src", "common", "omnihive-core-esm", "index.d.ts.map"), () => {});
    fse.unlink(path.join("..", "src", "common", "omnihive-core-esm", "index.js"), () => {});
    fse.unlink(path.join("..", "src", "common", "omnihive-core-esm", "index.js.map"), () => {});
};

clean();
