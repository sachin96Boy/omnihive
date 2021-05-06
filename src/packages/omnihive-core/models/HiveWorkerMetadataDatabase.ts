export class HiveWorkerMetadataDatabase {
    public databaseName: string = "";
    public ignoreSchema: boolean = true;
    public password: string = "";
    public procGraphSchemaName: string = "";
    public procSchemaExecutor: string = "";
    public requireSsl: boolean = false;
    public rowLimit: number = 0;
    public schemas: string[] = [];
    public serverAddress: string = "";
    public serverPort: number = 0;
    public sslCertPath: string = "";
    public tableSchemaExecutor: string = "";
    public urlRoute: string = "";
    public userName: string = "";
}
