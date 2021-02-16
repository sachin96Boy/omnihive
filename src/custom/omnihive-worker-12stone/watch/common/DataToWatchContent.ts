import dayjs from "dayjs";
import { WatchContent } from "../../lib/models/WatchModels";

export const transformDataToWatchContent = (data: any): WatchContent | undefined => {
    const content: WatchContent = {
        id: data.DocumentId,
        duration: data["Video Attributes - Video Length|Video Attributes|1"],
        date: dayjs(data.PublishDate),
        description: data.Content,
        poster: data["Featured Image Url"],
        title: data.Title,
        url: data["Video Attributes - Video Url|Video Attributes|1"],
    };

    if (content.id && content.date && content.poster && content.title && content.url) {
        return content;
    }

    return undefined;
};
