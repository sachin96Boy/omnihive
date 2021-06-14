import React from "react";
import { ToastContainer } from "./ToastContainer";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExclamationCircle } from "@fortawesome/free-solid-svg-icons";

type ToastInfoProps = {
    show: boolean;
    message: string;
};

export const ToastInfo: React.FC<ToastInfoProps> = (props): React.ReactElement => {
    return (
        <>
            {props.show && (
                <ToastContainer>
                    <div className="flex items-center bg-yellow-600 border-l-4 border-yellow-800 py-2 px-3 shadow-md mb-2">
                        <div className="mr-3">
                            <FontAwesomeIcon color="white" icon={faExclamationCircle} size="2x" />
                        </div>
                        <div className="text-black max-w-xs ">{props.message}</div>
                    </div>
                </ToastContainer>
            )}
        </>
    );
};
