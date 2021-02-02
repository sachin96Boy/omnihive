import { CoreServiceFactory } from "@withonevision/omnihive-core/factories/CoreServiceFactory";
import { InstanceService } from "../services/InstanceService";
import { ServerService } from "../services/ServerService";
import { ConnectionService } from "../services/ConnectionService";

export class NodeServiceFactory extends CoreServiceFactory {
    public static get connectionService(): ConnectionService {
        return ConnectionService.getSingleton();
    }

    public static get instanceService(): InstanceService {
        return InstanceService.getSingleton();
    }

    public static get serverService(): ServerService {
        return ServerService.getSingleton();
    }
}
