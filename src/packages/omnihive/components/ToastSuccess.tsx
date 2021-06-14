import { faCheckCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";
import { ToastContainer } from "./ToastContainer";

type ToastSuccessProps = {
    show: boolean;
    message: string;
};

export const ToastSuccess: React.FC<ToastSuccessProps> = (props): React.ReactElement => {
    return (
        <>
            {props.show && (
                <ToastContainer>
                    <div className="flex items-center bg-green-600 border-l-4 border-green-800 py-2 px-3 shadow-md mb-2">
                        <div className="mr-3">
                            <FontAwesomeIcon color="white" icon={faCheckCircle} size="2x" />
                        </div>
                        <div className="text-white max-w-xs ">{props.message}</div>
                    </div>
                </ToastContainer>
            )}
        </>
    );
};
