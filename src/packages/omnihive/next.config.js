const NodeServiceFactory = require("@withonevision/omnihive-core-node/factories/NodeServiceFactory");

module.exports = {
    basePath: `${
        NodeServiceFactory.NodeServiceFactory.serverService.getRootUrlPathName() === "/"
            ? "/admin"
            : NodeServiceFactory.NodeServiceFactory.serverService.getRootUrlPathName() + "/admin"
    }`,
};
