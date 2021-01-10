import { IHiveWorker } from "./IHiveWorker";

export interface IEncryptionWorker extends IHiveWorker {
    base64Encode: (toEncode: string) => string;
    base64Decode: (toDecode: string) => string;
    symmetricDecrypt: (message: string) => string;
    symmetricEncrypt: (message: string) => string;
}