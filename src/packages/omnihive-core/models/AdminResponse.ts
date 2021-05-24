export class AdminResponse<T = {}> {
    public data?: T | undefined;
    public clusterId: string;
    public requestComplete?: boolean;
    public requestError?: string | undefined;

    constructor() {
        this.clusterId = "";
        this.requestComplete = true;
        this.requestError = undefined;
        this.data = undefined;
    }
}
