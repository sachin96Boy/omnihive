export class AdminRequest<T = {}> {
    public adminPassword: string = "";
    public serverId: string = "";
    public data?: T | undefined = undefined;
}
