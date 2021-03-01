import { Dayjs } from "dayjs";

export interface WatchContent {
    id: number;
    duration: string;
    date?: Dayjs;
    description: string;
    poster: string;
    title: string;
    url: string;
}
