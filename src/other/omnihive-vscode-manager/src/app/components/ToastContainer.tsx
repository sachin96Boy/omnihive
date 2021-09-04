import React from "react";

export const ToastContainer: React.FC = (props): React.ReactElement => {
    return <div className="fixed right-0 top-0 m-5 z-50">{props.children}</div>;
};
