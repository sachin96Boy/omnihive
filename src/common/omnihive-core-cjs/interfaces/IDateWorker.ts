import { IHiveWorker } from "./IHiveWorker";

export interface IDateWorker extends IHiveWorker {
    convertDateBetweenTimezones: (date: Date, toTimezone: string, fromTimezone?: string) => string;
    getFormattedDateString: (date: Date, format?: string) => string;
}
