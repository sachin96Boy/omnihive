import React from "react";
import { WebpanelImageSources } from "../../models/WebpanelImageSources";
import { ModalWrapper } from "./ModalWrapper";

type Props = {
    confirmMessage: string;
    onOk: () => void;
    onCancel: () => void;
    imageSources: WebpanelImageSources;
};

export const ConfirmModal: React.FC<Props> = (props): React.ReactElement => {
    return (
        <ModalWrapper>
            <div>
                <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full">
                    <img className="mx-auto" alt="OmniHive Logo" src={props.imageSources.beeDark} />
                </div>
                <div className="mt-3 text-center sm:mt-5">
                    <span className="text-sm font-medium text-gray-700">{props.confirmMessage}</span>
                </div>
            </div>
            <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                <button
                    type="button"
                    className="disabled:opacity-25 w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-omnihive-orange text-base font-medium text-white hover:bg-omnihive-orangeHover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-900 sm:col-start-2 sm:text-sm"
                    onClick={() => props.onOk()}
                >
                    OK
                </button>
                <button
                    type="button"
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-900 sm:mt-0 sm:col-start-1 sm:text-sm"
                    onClick={() => props.onCancel()}
                >
                    Cancel
                </button>
            </div>
        </ModalWrapper>
    );
};
