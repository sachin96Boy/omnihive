export class BaseSettings {
    public adminPassword: string = "";
    public adminPortNumber: number = 7205;
    public adminRedisEnable: boolean = false;
    public adminRedisHost: string = "";
    public adminRedisPort: number = 6379;
    public adminRedisPassword: string = "";
    public clusterId: string = "";
    public hardResetOnRefresh: boolean = false;
    public nodePortNumber: number = 3001;
    public webRootUrl: string = "";
}
