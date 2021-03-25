import { HiveWorker } from "./HiveWorker";

export class ClientSettings {
    public rootUrl: string = "";
    public workers?: HiveWorker[] | undefined = undefined;
    public tokenMetadata?: any | undefined = undefined;
}
