import { EnvironmentVariable, EnvironmentVariableType, IsHelper } from "@withonevision/omnihive-core-cjs/index";
import isEqual from "lodash.isequal";
import React from "react";
import { WebpanelImageSources } from "../../models/WebpanelImageSources";
import { FormStyles } from "../common/CommonStyles";
import { ModalWrapper } from "./ModalWrapper";

export interface EnvironmentEditorObject extends EnvironmentVariable {
    index: number;
}

type Props = {
    compareKeys: string[];
    editorObject: EnvironmentEditorObject;
    onCancel: () => void;
    onOk: (editorObject: EnvironmentEditorObject) => void;
    onDelete: (indexValue: number) => void;
    imageSources: WebpanelImageSources;
};

export const EnvironmentModal: React.FC<Props> = (props): React.ReactElement => {
    const originalEditorObject: EnvironmentEditorObject = Object.assign({}, props.editorObject);

    const [currentEditorKey, setCurrentEditorKey] = React.useState<string>(props.editorObject.key);
    const [currentEditorValue, setCurrentEditorValue] = React.useState<string | number | boolean | undefined>(
        props.editorObject.value
    );
    const [nameError, setNameError] = React.useState<string>("");
    const [valueError, setValueError] = React.useState<string>("");

    const checkName = (value: string): void => {
        if (IsHelper.isEmptyStringOrWhitespace(value)) {
            setNameError("Name cannot be blank");
            return;
        }

        if (value.includes(" ")) {
            setNameError("Name cannot have a space as it is a JSON key");
            return;
        }

        const copyCompareKeys: string[] = [...props.compareKeys];

        if (props.editorObject.index >= 0) {
            copyCompareKeys.splice(props.editorObject.index, 1);
        }

        if (copyCompareKeys.includes(value)) {
            setNameError("Duplicate setting name");
            return;
        }

        setNameError("");
    };

    const checkValue = (value: string | number | boolean): void => {
        if (
            props.editorObject.type === EnvironmentVariableType.String &&
            IsHelper.isEmptyStringOrWhitespace(value.toString())
        ) {
            setValueError("Value cannot be blank");
            return;
        }

        setValueError("");
    };

    const disableEditorOk = (): boolean => {
        if (
            IsHelper.isEmptyStringOrWhitespace(currentEditorKey) ||
            IsHelper.isEmptyStringOrWhitespace(currentEditorValue)
        ) {
            return true;
        }

        if (!IsHelper.isEmptyStringOrWhitespace(nameError) || !IsHelper.isEmptyStringOrWhitespace(valueError)) {
            return true;
        }

        const newObject: EnvironmentEditorObject = {
            index: originalEditorObject.index,
            key: currentEditorKey,
            type: props.editorObject.type,
            value: currentEditorValue,
            isSystem: props.editorObject.isSystem,
        };

        return isEqual(originalEditorObject, newObject);
    };

    return (
        <ModalWrapper>
            <div className="w-11/12 m-auto">
                <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full">
                    <img className="mx-auto" alt="OmniHive Logo" src={props.imageSources.beeDark} />
                </div>
                <div className="mt-3 sm:mt-5">
                    <div>
                        <div className={FormStyles.formInputContainer}>
                            <label className={FormStyles.formInputLabel}>Setting</label>
                            <input
                                className={FormStyles.formInput}
                                style={nameError !== "" ? { border: "2px solid red" } : {}}
                                type="text"
                                name="name"
                                value={currentEditorKey}
                                readOnly={props.editorObject.isSystem}
                                disabled={props.editorObject.isSystem}
                                onChange={(e) => {
                                    setCurrentEditorKey(e.target.value);
                                    checkName(e.target.value);
                                }}
                            />
                            {nameError !== "" && <div className="pt-2 text-red-600">{nameError}</div>}
                        </div>
                        <div className={FormStyles.formInputContainer}>
                            <label className={FormStyles.formInputLabel}>Value</label>
                            {(props.editorObject.type === EnvironmentVariableType.Number ||
                                props.editorObject.type === EnvironmentVariableType.String) && (
                                <>
                                    <input
                                        className={FormStyles.formInput}
                                        style={valueError !== "" ? { border: "2px solid red" } : {}}
                                        type={
                                            props.editorObject.type === EnvironmentVariableType.Number
                                                ? "number"
                                                : "text"
                                        }
                                        name="value"
                                        value={currentEditorValue?.toString()}
                                        onChange={(e) => {
                                            setCurrentEditorValue(e.target.value);
                                            checkValue(e.target.value);
                                        }}
                                    />
                                    {valueError !== "" && <div className="pt-2 text-red-600">{valueError}</div>}
                                </>
                            )}
                            {props.editorObject.type === "boolean" && (
                                <div className="pl-4 pt-1 flex flex-row space-x-4 w-full text-gray-700">
                                    <div>
                                        <input
                                            type="radio"
                                            name="editGroup"
                                            value="true"
                                            checked={currentEditorValue === true || currentEditorValue === "true"}
                                            onChange={(e) => {
                                                setCurrentEditorValue(true);
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <span>True</span>
                                    </div>
                                    <div>
                                        <input
                                            type="radio"
                                            name="editGroup"
                                            value="false"
                                            checked={currentEditorValue === false || currentEditorValue === "false"}
                                            onChange={(e) => {
                                                setCurrentEditorValue(false);
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <span>False</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex flex-row">
                {disableEditorOk() && (
                    <button
                        disabled={true}
                        type="button"
                        className="cursor-not-allowed disabled:opacity-50 mr-2 ml-2 mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-omnihive-orange text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-900"
                    >
                        OK
                    </button>
                )}
                {!disableEditorOk() && (
                    <button
                        type="button"
                        className="mr-2 ml-2 mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-omnihive-orange text-base font-medium text-white hover:bg-omnihive-orangeHover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-900"
                        onClick={() =>
                            props.onOk({
                                index: originalEditorObject.index,
                                key: currentEditorKey,
                                value: currentEditorValue,
                                type: props.editorObject.type,
                                isSystem: props.editorObject.isSystem,
                            })
                        }
                    >
                        OK
                    </button>
                )}
                <button
                    type="button"
                    className="mr-2 ml-2 mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-900"
                    onClick={() => props.onCancel()}
                >
                    Cancel
                </button>
                {!props.editorObject.isSystem && (
                    <button
                        type="button"
                        className="mr-2 ml-2 mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-900"
                        onClick={() => props.onDelete(originalEditorObject.index)}
                    >
                        Delete
                    </button>
                )}
            </div>
        </ModalWrapper>
    );
};
