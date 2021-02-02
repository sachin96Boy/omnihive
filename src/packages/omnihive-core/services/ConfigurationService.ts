import { HiveAccount } from "../models/HiveAccount";
import { ServerSettings } from "../models/ServerSettings";

export class ConfigurationService {
    private static instance: ConfigurationService;

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    private constructor() {}

    public static getInstance = (): ConfigurationService => {
        if (!ConfigurationService.instance) {
            ConfigurationService.instance = new ConfigurationService();
        }

        return ConfigurationService.instance;
    };

    public account: HiveAccount = new HiveAccount();
    public settings: ServerSettings = new ServerSettings();
}
