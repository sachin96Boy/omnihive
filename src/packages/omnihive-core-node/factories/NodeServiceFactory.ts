import { AppService } from "../services/AppService";
import { TestService } from "../services/TestService";

export class NodeServiceFactory {
    public static get appService(): AppService {
        return AppService.getSingleton();
    }

    public static get testService(): TestService {
        return TestService.getSingleton();
    }
}
