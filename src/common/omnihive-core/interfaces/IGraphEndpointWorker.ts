import { GraphContext } from "../models/GraphContext.js";
import { IHiveWorker } from "./IHiveWorker.js";

export interface IGraphEndpointWorker extends IHiveWorker {
    execute: (customArgs: any, omniHiveContext: GraphContext) => Promise<{}>;
}
