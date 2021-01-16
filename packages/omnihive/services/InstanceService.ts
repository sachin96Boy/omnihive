import Conf from "conf";

export class InstanceService {

    public config = new Conf({ projectName: "omnihive", configName: "omnihive" });

    public list = async (): Promise<void> => {
        return;
    }

    public add = async (_name: string, _settings: string | undefined): Promise<void> => {
        return;
    }

    public edit = async (_name: string, _settings: string): Promise<void> => {
        return;
    }

    public remove = async (_name: string): Promise<void> => {
        return;
    }
}