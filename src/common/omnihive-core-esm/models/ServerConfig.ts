import { EnvironmentVariable } from "./EnvironmentVariable.js";
import { HiveWorkerConfig } from "./HiveWorkerConfig.js";

export class ServerConfig {
    public environmentVariables: EnvironmentVariable[] = [];
    public workers: HiveWorkerConfig[] = [];
}
