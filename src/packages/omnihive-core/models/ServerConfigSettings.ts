export class ServerConfigSettings {
    public adminPassword: string = "";
    public serverGroupName: string = "";
    public portNumber: number = 3001;
    public rootUrl: string = "";
    public features: { [key: string]: boolean } = {};
}
