/// <reference path="../globals.omnihive.core.d.ts" />

import { ConnectionSchema } from "../models/ConnectionSchema";

export class ConnectionService {
    public getAllSchemas = (): ConnectionSchema[] => {
        return global.omnihive.core.registeredSchemas ?? [];
    };

    public getSchema = (workerName: string): ConnectionSchema | undefined => {
        return global.omnihive.core.registeredSchemas?.find(
            (value: ConnectionSchema) => value.workerName === workerName
        );
    };

    public pushSchema = (schema: ConnectionSchema) => {
        let globalSchemas: ConnectionSchema[] | undefined = global.omnihive.core.registeredSchemas;

        if (!globalSchemas) {
            globalSchemas = [];
        }

        globalSchemas.push(schema);
        global.omnihive.core.registeredSchemas = globalSchemas;
    };
}
