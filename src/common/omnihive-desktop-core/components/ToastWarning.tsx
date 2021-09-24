import React from "react";
import toastWarningIcon from "../assets/toastWarning.png";
import { ToastCommonStyles } from "./ToastCommonStyles";
import { ToastContainer } from "./ToastContainer";

export type ToastWarningProps = {
    show: boolean;
    message: string;
};

export const ToastWarning: React.FC<ToastWarningProps> = (props): React.ReactElement => {
    return (
        <>
            {props.show && (
                <ToastContainer>
                    <div className={`${ToastCommonStyles.Container} bg-omnihiveOrange border-omnihiveOrangeHover`}>
                        <div className={ToastCommonStyles.IconContainer}>
                            <img src={toastWarningIcon} alt="warning" className={ToastCommonStyles.Icon} />
                        </div>
                        <div className={`${ToastCommonStyles.Message} text-black`}>{props.message}</div>
                    </div>
                </ToastContainer>
            )}
        </>
    );
};
