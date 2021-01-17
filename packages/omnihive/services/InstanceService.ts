import { RegisteredInstance } from "@withonevision/omnihive-common/models/RegisteredInstance";
import Conf from "conf";
import { ObjectHelper } from "@withonevision/omnihive-common/helpers/ObjectHelper";
import { ServerSettings } from "@withonevision/omnihive-common/models/ServerSettings";
import fs from "fs";

export class InstanceService {

    private config = new Conf({ projectName: "omnihive", configName: "omnihive" });

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
        return true;
    }

    public get = (name: string): RegisteredInstance | undefined => {

        const instance: RegisteredInstance | undefined = this.getAll().find((value: RegisteredInstance) => value.name === name);

        if (!instance) {
            return undefined;
        }

        return instance;
    }

    public getAll = (): RegisteredInstance[] => {
        const instances: unknown = this.config.get("instances");

        if (!instances) {
            return [];
        } else {
            return ObjectHelper.createArrayStrict(RegisteredInstance, instances as RegisteredInstance[]);
        }
    }

    public edit = (name: string, settings: string): boolean => {

        if (!this.checkSettings(settings)) {
            return false;
        }

        const instances: RegisteredInstance[] = this.getAll();
        const instance: RegisteredInstance | undefined = this.get(name);

        if (instance) {
            instances.filter((value: RegisteredInstance) => value.name !== instance.name);
            instances.push(instance);
            this.writeInstances(instances);
        } else {
            instances.push({ name, settings });
            this.writeInstances(instances);
        }

        return true;
    }

    public remove = (name: string): boolean => {

        let instances: RegisteredInstance[] = this.getAll();
        const instance: RegisteredInstance | undefined = this.get(name);

        if (!instance) {
            return false;
        }

        instances = instances.filter((instance: RegisteredInstance) => instance.name !== name);
        this.writeInstances(instances);
        return true;
    }

    public writeInstances = (instances: RegisteredInstance[]) => {
        this.config.set("instances", instances);
    }

    private checkSettings = (settingsPath: string): boolean => {

        try {
            const config: ServerSettings = ObjectHelper.createStrict(ServerSettings, JSON.parse(
                fs.readFileSync(`${settingsPath}`, { encoding: "utf8" })));

            if (config) {
                return true;
            }

            return false;
        } catch {
            return false;
        }

    }
}