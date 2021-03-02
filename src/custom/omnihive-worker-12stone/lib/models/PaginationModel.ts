export type PaginationModel<T> = {
    nextPageNumber: number | undefined;
    previousPageNumber: number | undefined;
    totalCount: number;
    data: T[];
};
