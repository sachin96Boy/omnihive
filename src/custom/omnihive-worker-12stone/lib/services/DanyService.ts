import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { CoreServiceFactory } from "@withonevision/omnihive-core/factories/CoreServiceFactory";

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

    public getMetaData = (workerName: string) => {
        const graphWorkers = CoreServiceFactory.workerService.getWorkersByType(HiveWorkerType.GraphEndpointFunction);

        const metadata = graphWorkers.find((worker: any) => worker.name === workerName)?.metadata;

        DanyService.singleton.apiKey = metadata.apiKey;
        DanyService.singleton.rootUrl = metadata.rootUrl;
    };
}
