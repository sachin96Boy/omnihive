export class AdminRequest<T = {}> {
    public adminPassword: string = "";
    public serverGroupId: string = "";
    public data?: T | undefined = undefined;
}
