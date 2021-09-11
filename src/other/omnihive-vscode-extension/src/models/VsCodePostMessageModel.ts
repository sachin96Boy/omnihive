import { VsCodeCommand } from "../enums/VsCodeCommand";

export type VsCodePostMessageModel = {
    command: VsCodeCommand;
    data: any;
};
