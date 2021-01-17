import { ObjectHelper } from "@withonevision/omnihive-common/helpers/ObjectHelper";
import { RegisteredInstance } from "@withonevision/omnihive-common/models/RegisteredInstance";
import Conf from "conf/dist/source";

export class InstanceHelper {

    public config = new Conf({ projectName: "omnihive", configName: "omnihive" });

    public add = (instance: RegisteredInstance): boolean => {
        const instances: RegisteredInstance[] = this.getAll();
        instances.push(instance);
        this.config.set("instances", instances);
        return true;
    }

    public edit = (instance: RegisteredInstance): boolean => {
        const instances: RegisteredInstance[] = this.getAll();
        instances.filter((value: RegisteredInstance) => value.name !== instance.name);
        instances.push(instance);
        this.config.set("instances", instances);
        return true;
    }

    public getAll = (): RegisteredInstance[] => {
        const instances: unknown = this.config.get("instances");

        if (!instances) {
            return [];
        } else {
            return ObjectHelper.createArrayStrict(RegisteredInstance, instances as RegisteredInstance[]);
        }
    }

    public get = (name: string): RegisteredInstance | undefined => {
        
        const instance: RegisteredInstance | undefined = this.getAll().find((value: RegisteredInstance) => value.name === name);

        if (!instance) {
            return undefined;
        }

        return instance;
    }

    public remove = (name: string): boolean => {
        const instance: RegisteredInstance | undefined = this.getAll().find((value: RegisteredInstance) => value.name === name);

        if (!instance) {
            return false;
        }

        this.config.delete(name);
        return true;
    }
}