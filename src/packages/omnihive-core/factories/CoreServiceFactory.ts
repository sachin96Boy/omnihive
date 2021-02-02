import { ConfigurationService } from "../services/ConfigurationService";
import { WorkerService } from "../services/WorkerService";

export class CoreServiceFactory {
    public static get configurationService(): ConfigurationService {
        return ConfigurationService.getSingleton();
    }

    public static get workerService(): WorkerService {
        return WorkerService.getSingleton();
    }
}
