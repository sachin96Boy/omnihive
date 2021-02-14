import { ConfigurationService } from "../services/ConfigurationService";
import { ConnectionService } from "../services/ConnectionService";
import { WorkerService } from "../services/WorkerService";

export class CoreServiceFactory {
    private static _configurationService: ConfigurationService | undefined = undefined;
    private static _connectionService: ConnectionService | undefined = undefined;
    private static _workerService: WorkerService | undefined = undefined;

    public static get configurationService(): ConfigurationService {
        if (!this._configurationService) {
            this._configurationService = new ConfigurationService();
        }

        return this._configurationService;
    }

    public static get connectionService(): ConnectionService {
        if (!this._connectionService) {
            this._connectionService = new ConnectionService();
        }

        return this._connectionService;
    }

    public static get workerService(): WorkerService {
        if (!this._workerService) {
            this._workerService = new WorkerService();
        }

        return this._workerService;
    }
}
