const ServerStore = require("./stores/ServerStore");

module.exports = {
  basePath: `${ServerStore.ServerStore.getInstance().getRootUrlPathName() === "/" ? "/admin" : ServerStore.ServerStore.getInstance().getRootUrlPathName() + "/admin"}`,
}