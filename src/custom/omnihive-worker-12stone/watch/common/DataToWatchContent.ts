import dayjs from "dayjs";
import { WatchContent } from "../../lib/models/WatchModels";

export const transformDataToWatchContent = (data: any): WatchContent | undefined => {
    const content: WatchContent = {
        id: data.DocumentId,
        duration: data["Video Attributes - Video Length"],
        date: dayjs(data.PublishDate),
        description: data.Content,
        poster: data["Featured Image Url"],
        title: data.Title,
        url: data["Video Attributes - Video Url"],
    };

    if (content.id && content.date && content.poster && content.title && content.url) {
        return content;
    }

    return undefined;
};
