import React from "react";
import toastErrorIcon from "../assets/toastError.png";
import { ToastCommonStyles } from "./ToastCommonStyles";
import { ToastContainer } from "./ToastContainer";

export type ToastErrorProps = {
    show: boolean;
    message: string;
};

export const ToastError: React.FC<ToastErrorProps> = (props): React.ReactElement => {
    return (
        <>
            {props.show && (
                <ToastContainer>
                    <div className={`${ToastCommonStyles.Container} bg-red-600 border-red-800`}>
                        <div className={ToastCommonStyles.IconContainer}>
                            <img src={toastErrorIcon} alt="error" className={ToastCommonStyles.Icon} />
                        </div>
                        <div className={`${ToastCommonStyles.Message} text-white`}>
                            <p className="break-all">{props.message}</p>
                        </div>
                    </div>
                </ToastContainer>
            )}
        </>
    );
};
