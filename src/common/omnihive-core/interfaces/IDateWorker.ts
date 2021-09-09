import { IHiveWorker } from "./IHiveWorker.js";

export interface IDateWorker extends IHiveWorker {
    convertDateBetweenTimezones: (date: Date, toTimezone: string, fromTimezone?: string) => string;
    getFormattedDateString: (date: Date, format?: string) => string;
}
