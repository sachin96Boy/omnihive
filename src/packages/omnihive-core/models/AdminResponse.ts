export class AdminResponse<T = {}> {
    public data?: T | undefined;
    public serverId: string;
    public requestComplete?: boolean;
    public requestError?: string | undefined;

    constructor() {
        this.serverId = "";
        this.requestComplete = true;
        this.requestError = undefined;
        this.data = undefined;
    }
}
