const OmniHiveStore = require("./stores/OmniHiveStore");

module.exports = {
    basePath: `${
        OmniHiveStore.OmniHiveStore.getInstance().getRootUrlPathName() === "/"
            ? "/admin"
            : OmniHiveStore.OmniHiveStore.getInstance().getRootUrlPathName() + "/admin"
    }`,
};
