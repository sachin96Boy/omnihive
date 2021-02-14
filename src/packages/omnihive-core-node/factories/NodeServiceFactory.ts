import { AppService } from "../services/AppService";
import { TestService } from "../services/TestService";

export class NodeServiceFactory {
    private static _appService: AppService | undefined = undefined;
    private static _testService: TestService | undefined = undefined;

    public static get appService(): AppService {
        if (!this._appService) {
            this._appService = new AppService();
        }

        return this._appService;
    }

    public static get testService(): TestService {
        if (!this._testService) {
            this._testService = new TestService();
        }

        return this._testService;
    }
}
