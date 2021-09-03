export type FormCommonStylesType = {
    Error: string;
    ErrorInputBorder: any;
    Input: string;
    InputContainer: string;
    InputLabel: string;
};

export const FormCommonStyles: FormCommonStylesType = {
    Error: "pt-2 text-red-600",
    ErrorInputBorder: {
        border: "2px solid red",
    },
    Input: "px-2 py-2 placeholder-gray-400 text-black relative bg-white rounded text-sm shadow outline-none focus:outline-none focus:shadow-md w-full",
    InputContainer: "mb-6",
    InputLabel: "block text-gray-500 text-sm font-bold mb-2",
};
