const NodeStore = require("./stores/NodeStore");

module.exports = {
  basePath: `${NodeStore.NodeStore.getInstance().getRootUrlPathName() === "/" ? "/admin" : NodeStore.NodeStore.getInstance().getRootUrlPathName() + "/admin"}`,
}