import { ObjectHelper } from "@withonevision/omnihive-common/helpers/ObjectHelper";
import { RegisteredInstance } from "@withonevision/omnihive-common/models/RegisteredInstance";
import { ServerSettings } from "@withonevision/omnihive-common/models/ServerSettings";
import chalk from "chalk";
import Conf from "conf";
import fs from "fs";

export class InstanceService {
    private config = new Conf({
        projectName: "omnihive",
        configName: "omnihive",
    });

    public add = (name: string, settings: string): boolean => {
        if (!this.checkSettings(settings)) {
            return false;
        }

        const instances: RegisteredInstance[] = this.getAll();
        const instance: RegisteredInstance | undefined = this.get(name);

        if (instance) {
            return false;
        }

        instances.push({ name, settings });
        this.writeInstances(instances);

        if (instances.length === 1) {
            this.setLatestInstance(name);
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

    public getLatest = (): RegisteredInstance | undefined => {
        return this.get("latest");
    };

    public edit = (name: string, settings: string): boolean => {
        if (!this.checkSettings(settings)) {
            return false;
        }

        const instance: RegisteredInstance | undefined = this.get(name);

        if (instance) {
            this.remove(name);
            this.add(name, settings);
        } else {
            this.add(name, settings);
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
            fs.unlinkSync(instance.settings);
        } catch {
            console.log(chalk.yellow("Instance settings file not found...continuing on"));
        }

        const latest: RegisteredInstance | undefined = this.getLatest();

        if (latest && latest.name === name) {
            this.config.set("latest", undefined);
        }

        instances = instances.filter((instance: RegisteredInstance) => instance.name !== name);
        this.writeInstances(instances);
        return true;
    };

    public setLatestInstance = (name: string): boolean => {
        this.config.set("latest", this.get(name));
        return true;
    };

    public writeInstances = (instances: RegisteredInstance[]) => {
        this.config.set("instances", instances);
    };

    private checkSettings = (settingsPath: string): boolean => {
        try {
            const config: ServerSettings = ObjectHelper.createStrict(
                ServerSettings,
                JSON.parse(fs.readFileSync(`${settingsPath}`, { encoding: "utf8" }))
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
