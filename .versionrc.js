const fse = require("fs-extra");
const path = require("path");

const rcObject = {
    packageFiles: [],
    bumpFiles: [],
    types: [
        { type: "build", section: "Build", hidden: false },
        { type: "chore", section: "Code Maitenance", hidden: false },
        { type: "ci", section: "Build", hidden: false },
        { type: "docs", section: "Documentation", hidden: false },
        { type: "feat", section: "Features", hidden: false },
        { type: "fix", section: "Bug Fixes", hidden: false },
        { type: "perf", section: "Performance", hidden: false },
        { type: "refactor", section: "Code Maintenance", hidden: false },
        { type: "revert", section: "Code Maintenance", hidden: false },
        { type: "style", section: "Code Maintenance", hidden: false },
        { type: "test", section: "Tests", hidden: false },
    ],
};

function buildVersionRc() {
    rcObject.packageFiles.push({
        filename: `${path.join(".", "package.json")}`,
        type: "json",
    });

    rcObject.bumpFiles.push({
        filename: `${path.join(".", "package.json")}`,
        type: "json",
    });

    fse.readdirSync(path.join(`.`, `src`, `common`))
        .filter((f) => fse.statSync(path.join(`.`, `src`, `common`, f)).isDirectory())
        .forEach((directory) => {
            rcObject.bumpFiles.push({
                filename: `${path.join(".", "src", "common", directory, "package.json")}`,
                type: "json",
            });
        });

    fse.readdirSync(path.join(`.`, `src`, `desktop`))
        .filter((f) => fse.statSync(path.join(`.`, `src`, `desktop`, f)).isDirectory())
        .forEach((directory) => {
            rcObject.bumpFiles.push({
                filename: `${path.join(".", "src", "desktop", directory, "package.json")}`,
                type: "json",
            });
        });

    fse.readdirSync(path.join(`.`, `src`, `extras`))
        .filter((f) => fse.statSync(path.join(`.`, `src`, `extras`, f)).isDirectory())
        .forEach((directory) => {
            rcObject.bumpFiles.push({
                filename: `${path.join(".", "src", "extras", directory, "package.json")}`,
                type: "json",
            });
        });

    fse.readdirSync(path.join(`.`, `src`, `other`))
        .filter((f) => fse.statSync(path.join(`.`, `src`, `other`, f)).isDirectory())
        .forEach((directory) => {
            rcObject.bumpFiles.push({
                filename: `${path.join(".", "src", "other", directory, "package.json")}`,
                type: "json",
            });
        });

    fse.readdirSync(path.join(`.`, `src`, `server`))
        .filter((f) => fse.statSync(path.join(`.`, `src`, `server`, f)).isDirectory())
        .forEach((directory) => {
            rcObject.bumpFiles.push({
                filename: `${path.join(".", "src", "server", directory, "package.json")}`,
                type: "json",
            });
        });

    return rcObject;
}

module.exports = buildVersionRc();
