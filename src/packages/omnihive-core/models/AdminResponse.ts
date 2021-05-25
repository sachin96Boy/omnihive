export class AdminResponse<T = {}> {
    public data?: T | undefined;
    public serverGroupId: string;
    public requestComplete?: boolean;
    public requestError?: string | undefined;

    constructor() {
        this.serverGroupId = "";
        this.requestComplete = true;
        this.requestError = undefined;
        this.data = undefined;
    }
}
