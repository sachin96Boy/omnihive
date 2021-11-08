import express from "express";
import { IHiveWorker } from "./IHiveWorker";

export interface IExpressWorker extends IHiveWorker {
    execute: (app: express.Express) => Promise<void>;
}
