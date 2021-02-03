import { ConnectionSchema } from "@withonevision/omnihive-core/models/ConnectionSchema";

export class ConnectionService {
    private static singleton: ConnectionService;

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    private constructor() {}

    public static getSingleton = (): ConnectionService => {
        if (!ConnectionService.singleton) {
            ConnectionService.singleton = new ConnectionService();
        }

        return ConnectionService.singleton;
    };

    public registeredSchemas: ConnectionSchema[] = [];

    public getSchema = (workerName: string): ConnectionSchema | undefined => {
        return this.registeredSchemas.find((value: ConnectionSchema) => value.workerName === workerName);
    };
}
