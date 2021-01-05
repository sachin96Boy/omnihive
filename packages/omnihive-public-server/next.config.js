const QueenStore = require("@withonevision/omnihive-hive-queen/stores/QueenStore");

module.exports = {
  basePath: `${QueenStore.QueenStore.getInstance().getRootUrlPathName() === "/" ? "/admin" : QueenStore.QueenStore.getInstance().getRootUrlPathName() + "/admin"}`,
}