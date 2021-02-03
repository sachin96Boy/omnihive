import { HiveAccount } from "../models/HiveAccount";
import { ServerSettings } from "../models/ServerSettings";

export class ConfigurationService {
    private static singleton: ConfigurationService;

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    private constructor() {}

    public static getSingleton = (): ConfigurationService => {
        if (!ConfigurationService.singleton) {
            ConfigurationService.singleton = new ConfigurationService();
        }

        return ConfigurationService.singleton;
    };

    public account: HiveAccount = new HiveAccount();
    public settings: ServerSettings = new ServerSettings();
}
