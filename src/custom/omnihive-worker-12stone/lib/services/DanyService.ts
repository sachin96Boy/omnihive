import { HiveWorkerType } from "@withonevision/omnihive-core/enums/HiveWorkerType";
import { WorkerService } from "@withonevision/omnihive-core/services/WorkerService";

export default class DanyService {
    private static singleton: DanyService;

    constructor() {}

    public static getSingleton = (): DanyService => {
        if (!DanyService.singleton) {
            DanyService.singleton = new DanyService();
        }

        return DanyService.singleton;
    };

    public apiKey: string = "";
    public rootUrl: string = "";

    public getMetaData = (workerName: string) => {
        const graphWorkers = WorkerService.getSingleton().getWorkersByType(
            HiveWorkerType.GraphEndpointFunction
        );

        const metadata = graphWorkers.find(
            (worker: any) => worker.name === workerName
        )?.metadata;

        DanyService.getSingleton().apiKey = metadata.apiKey;
        DanyService.getSingleton().rootUrl = metadata.rootUrl;
    };
}
