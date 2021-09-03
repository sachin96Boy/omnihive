import React from "react";
import { ToastContainer } from "./ToastContainer";
import { ToastCommonStyles } from "./ToastCommonStyles";
import toastErrorIcon from "../assets/toastError.png";

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
