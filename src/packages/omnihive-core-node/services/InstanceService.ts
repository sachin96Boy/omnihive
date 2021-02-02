import { ObjectHelper } from "@withonevision/omnihive-core/helpers/ObjectHelper";
import { StringHelper } from "@withonevision/omnihive-core/helpers/StringHelper";
import { OmniHiveConstants } from "@withonevision/omnihive-core/models/OmniHiveConstants";
import { RegisteredInstance } from "@withonevision/omnihive-core/models/RegisteredInstance";
import { ServerSettings } from "@withonevision/omnihive-core/models/ServerSettings";
import chalk from "chalk";
import Conf from "conf";
import fs from "fs";

export class InstanceService {
    private static instance: InstanceService;

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    private constructor() {}

    public static getInstance = (): InstanceService => {
        if (!InstanceService.instance) {
            InstanceService.instance = new InstanceService();
        }

        return InstanceService.instance;
    };

    private config = new Conf({
        projectName: OmniHiveConstants.CONF_NAME,
        configName: OmniHiveConstants.CONF_NAME,
    });

    public add = (newInstance: RegisteredInstance): boolean => {
        if (!this.checkInstance(newInstance)) {
            return false;
        }

        const instances: RegisteredInstance[] = this.getAll();
        const instance: RegisteredInstance | undefined = this.get(newInstance.name);

        if (instance) {
            return false;
        }

        instances.push(newInstance);
        this.writeInstances(instances);

        if (instances.length === 1) {
            this.setLastRun(newInstance.name);
        }

        return true;
    };

    public get = (name: string): RegisteredInstance | undefined => {
        const instance: RegisteredInstance | undefined = this.getAll().find(
            (value: RegisteredInstance) => value.name === name
        );

        if (!instance) {
            return undefined;
        }

        return instance;
    };

    public getAll = (): RegisteredInstance[] => {
        const instances: unknown = this.config.get("instances");

        if (!instances) {
            return [];
        } else {
            return ObjectHelper.createArrayStrict(RegisteredInstance, instances as RegisteredInstance[]);
        }
    };

    public getLastRun = (): RegisteredInstance | undefined => {
        return this.getAll().find((value: RegisteredInstance) => value.lastRun === true);
    };

    public getInstanceSettings = (name: string | undefined, settings: string | undefined): ServerSettings => {
        if (name && settings) {
            throw new Error(
                "You cannot provide both an instance name and a settings file to the configuration handler"
            );
        }

        if (!name && settings) {
            const settingsJson = JSON.parse(fs.readFileSync(settings, { encoding: "utf8" }));

            try {
                const serverSettings: ServerSettings = ObjectHelper.createStrict<ServerSettings>(
                    ServerSettings,
                    settingsJson
                );
                return serverSettings;
            } catch {
                throw new Error("Given settings file cannot be successfully parsed into a ServerSettings object");
            }
        }

        const configInstance: RegisteredInstance | undefined = this.get(name ?? "");

        if (!configInstance || StringHelper.isNullOrWhiteSpace(configInstance.settingsLocation)) {
            throw new Error(
                "The given instance name has not been registered.  Please use the command line to add a new instance"
            );
        }

        const settingsJson = JSON.parse(fs.readFileSync(configInstance.settingsLocation, { encoding: "utf8" }));

        try {
            const serverSettings: ServerSettings = ObjectHelper.createStrict<ServerSettings>(
                ServerSettings,
                settingsJson
            );
            return serverSettings;
        } catch {
            throw new Error("Given settings file cannot be successfully parsed into a ServerSettings object");
        }
    };

    public edit = (name: string, editedInstance: RegisteredInstance): boolean => {
        if (!this.checkInstance(editedInstance)) {
            return false;
        }

        const instance: RegisteredInstance | undefined = this.get(name);

        if (instance) {
            this.remove(name);
            this.add(editedInstance);
        } else {
            this.add(editedInstance);
        }

        return true;
    };

    public remove = (name: string): boolean => {
        let instances: RegisteredInstance[] = this.getAll();
        const instance: RegisteredInstance | undefined = this.get(name);

        if (!instance) {
            console.log(chalk.yellow("No instance found...continuing on."));
            return true;
        }

        try {
            fs.unlinkSync(instance.settingsLocation);
        } catch {
            console.log(chalk.yellow("Instance settings file not found...continuing on"));
        }

        const latest: RegisteredInstance | undefined = this.getLastRun();

        if (latest && latest.name === name) {
            this.config.set("latest", undefined);
        }

        instances = instances.filter((instance: RegisteredInstance) => instance.name !== name);
        this.writeInstances(instances);
        return true;
    };

    public setLastRun = (name: string): boolean => {
        const instance: RegisteredInstance | undefined = this.get(name);

        if (!instance) {
            return false;
        }

        instance.lastRun = true;
        this.edit(name, instance);

        return true;
    };

    public writeInstances = (instances: RegisteredInstance[]) => {
        this.config.set("instances", instances);
    };

    private checkInstance = (instance: RegisteredInstance): boolean => {
        try {
            const config: ServerSettings = ObjectHelper.createStrict(
                ServerSettings,
                JSON.parse(fs.readFileSync(`${instance.settingsLocation}`, { encoding: "utf8" }))
            );

            if (config) {
                return true;
            }

            return false;
        } catch {
            return false;
        }
    };
}
