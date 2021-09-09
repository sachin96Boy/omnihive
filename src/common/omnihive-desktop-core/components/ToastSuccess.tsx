import React from "react";
import { ToastContainer } from "./ToastContainer";
import { ToastCommonStyles } from "./ToastCommonStyles";
import toastSuccessIcon from "../assets/toastSuccess.png";

export type ToastSuccessProps = {
    show: boolean;
    message: string;
};

export const ToastSuccess: React.FC<ToastSuccessProps> = (props): React.ReactElement => {
    return (
        <>
            {props.show && (
                <ToastContainer>
                    <div className={`${ToastCommonStyles.Container} bg-green-600 border-green-800`}>
                        <div className={ToastCommonStyles.IconContainer}>
                            <img src={toastSuccessIcon} alt="success" className={ToastCommonStyles.Icon} />
                        </div>
                        <div className={`${ToastCommonStyles.Message} text-white`}>{props.message}</div>
                    </div>
                </ToastContainer>
            )}
        </>
    );
};
