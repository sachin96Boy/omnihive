import React from "react";
import { ToastContainer } from "./ToastContainer";

type ToastWarningProps = {
    show: boolean;
    message: string;
    warningPng: string;
};

export const ToastWarning: React.FC<ToastWarningProps> = (props): React.ReactElement => {
    return (
        <>
            {props.show && (
                <ToastContainer>
                    <div className="flex items-center bg-omnihive-orange border-l-4 border-omnihive-orangeHover py-2 px-3 shadow-md mb-2">
                        <div className="mr-3">
                            <img src={props.warningPng} alt="warning" className="h-8" />
                        </div>
                        <div className="text-black max-w-xs ">{props.message}</div>
                    </div>
                </ToastContainer>
            )}
        </>
    );
};
