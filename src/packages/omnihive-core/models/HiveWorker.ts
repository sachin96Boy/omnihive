export class HiveWorker {
    public type: string = "";
    public name: string = "";
    public package: string = "";
    public version: string = "";
    public importPath: string = "";
    public core: boolean = false;
    public default: boolean = true;
    public enabled: boolean = true;
    public metadata: any | undefined = undefined;
}
