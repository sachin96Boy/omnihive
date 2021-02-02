import { ConfigurationService } from "../services/ConfigurationService";
import { WorkerService } from "../services/WorkerService";

export class CoreServiceFactory {
    public static get configurationService(): ConfigurationService {
        return ConfigurationService.getInstance();
    }

    public static get workerService(): WorkerService {
        return WorkerService.getInstance();
    }
}
