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

    getPackageFolders().forEach((directory) => {
        rcObject.bumpFiles.push({
            filename: `${path.join(".", "src", "packages", directory, "package.json")}`,
            type: "json",
        });
    });

    return rcObject;
}

const getPackageFolders = () => {
    return fse
        .readdirSync(path.join(`.`, `src`, `packages`))
        .filter((f) => fse.statSync(path.join(`.`, `src`, `packages`, f)).isDirectory());
};

module.exports = buildVersionRc();
