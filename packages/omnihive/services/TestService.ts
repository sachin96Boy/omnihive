import { ServerSettings } from "@withonevision/omnihive-common/models/ServerSettings";
import { AppHelper } from "../helpers/AppHelper";

export class TestService {
    public start = async (name: string | undefined, settings: string | undefined): Promise<void> => {
        
        // Run basic app service
        const appHelper: AppHelper = new AppHelper();
        const [, appSettings]: [string, ServerSettings] = appHelper.getServerSettings(name, settings);
        await appHelper.initApp(appSettings);
        
        return;
    }
}