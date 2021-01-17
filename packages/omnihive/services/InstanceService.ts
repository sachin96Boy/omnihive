import chalk from "chalk";
import { InstanceHelper } from "../helpers/InstanceHelper";
import Table from 'cli-table';
import { RegisteredInstance } from "@withonevision/omnihive-common/models/RegisteredInstance";

export class InstanceService {

    private instanceHelper: InstanceHelper = new InstanceHelper();

    public list = (): void => {

        const instances: RegisteredInstance[] = this.instanceHelper.getAll();

        if (instances.length === 0) {
            console.log("There are no registered OmniHive instances");
            return;
        }

        const table = new Table({
            head: ['Name', 'Settings Location'],
            colWidths: [100, 200]
        });

        instances.forEach((instance: RegisteredInstance) => {
            table.push([instance.name, instance.settings]);
        });

        console.log(table.toString());
    }

    public add = (_name: string, _settings: string | undefined): void => {
        return;
    }

    public edit = (name: string, settings: string): void => {
        if (this.instanceHelper.get(name)) {
            this.instanceHelper.edit({ name, settings });
            console.log(chalk.green(`OmniHive instance ${name} successfully edited`));
        } else {
            this.instanceHelper.add({ name, settings });
            console.log(chalk.green(`OmniHive instance ${name} not found.  Adding instead.`));
        }
    }

    public remove = (name: string): void => {

        if (this.instanceHelper.get(name)) {
            this.instanceHelper.remove(name);
            console.log(chalk.green(`OmniHive instance ${name} successfully removed`));
        } else {
            console.log(chalk.red(`OmniHive instance ${name} not found in registered instances`));
        }

        return;
    }
}