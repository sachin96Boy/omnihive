export type ToastCommonStylesType = {
    Container: string;
    Icon: string;
    IconContainer: string;
    Message: string;
};

export const ToastCommonStyles: ToastCommonStylesType = {
    Container: `flex items-center bg-red-600 border-l-4 border-red-800 py-2 px-3 shadow-md mb-2`,
    Icon: `h-8`,
    IconContainer: `mr-3`,
    Message: `max-w-md`,
};
