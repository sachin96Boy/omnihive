export default class DanyService {
    private static singleton: DanyService;

    public static getSingleton = (): DanyService => {
        if (!DanyService.singleton) {
            DanyService.singleton = new DanyService();
        }

        return DanyService.singleton;
    };

    public apiKey: string = "";
    public rootUrl: string = "";

    public setMetaData = (metadata: any) => {
        DanyService.getSingleton().apiKey = metadata.apiKey;
        DanyService.getSingleton().rootUrl = metadata.rootUrl;
    };
}
