const fse = require("fs-extra");
const path = require("path");

function buildVersionRc() {
    const rcObject = {
        packageFiles: [],
        bumpFiles: [],
    };

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
