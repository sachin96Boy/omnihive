import { TestConfigSettings } from "./TestConfigSettings";

export class TestSettings {
    public tests: TestConfigSettings[] = [];
    public constants: { [key: string]: string }[] = [];
}
