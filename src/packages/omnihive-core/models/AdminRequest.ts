export class AdminRequest<T = {}> {
    public adminPassword: string = "";
    public clusterId: string = "";
    public data?: T | undefined = undefined;
}
