import { ServerService } from "../services/ServerService";
import { TestService } from "../services/TestService";

export class NodeServiceFactory {
    public static get serverService(): ServerService {
        return ServerService.getSingleton();
    }

    public static get testService(): TestService {
        return TestService.getSingleton();
    }
}
