import { HiveWorkerConfig, IsHelper } from "@withonevision/omnihive-core-cjs";
import isEqual from "lodash.isequal";
import React from "react";
import AceEditor from "react-ace";
import semver from "semver";
import yaml from "yaml";
import { EditorMarkupFormat } from "../../enums/EditorMarkupFormat";
import { ExtensionConfiguration } from "../../models/ExtensionConfiguration";
import { WebpanelImageSources } from "../../models/WebpanelImageSources";
import { FormStyles } from "../common/CommonStyles";
import { ModalWrapper } from "./ModalWrapper";

import "ace-builds/src-noconflict/mode-json";
import "ace-builds/src-noconflict/mode-yaml";
import "ace-builds/src-noconflict/theme-tomorrow_night";
export interface WorkerEditorObject extends HiveWorkerConfig {
    index: number;
}

type Props = {
    allowDelete: boolean;
    compareKeys: string[];
    editorObject: WorkerEditorObject;
    onCancel: () => void;
    onOk: (editorObject: WorkerEditorObject) => void;
    onDelete: (indexValue: number) => void;
    extensionConfiguration: ExtensionConfiguration;
    imageSources: WebpanelImageSources;
};

export const WorkerModal: React.FC<Props> = (props): React.ReactElement => {
    const originalEditorObject: WorkerEditorObject = Object.assign({}, props.editorObject);

    const [currentWorkerName, setCurrentWorkerName] = React.useState<string>(props.editorObject.name);
    const [currentWorkerType, setCurrentWorkerType] = React.useState<string>(props.editorObject.type);
    const [currentWorkerPackage, setCurrentWorkerPackage] = React.useState<string>(props.editorObject.package);
    const [currentWorkerVersion, setCurrentWorkerVersion] = React.useState<string>(props.editorObject.version);
    const [currentWorkerImportPath, setCurrentWorkerImportPath] = React.useState<string>(props.editorObject.importPath);
    const [currentWorkerDefault, setCurrentWorkerDefault] = React.useState<boolean>(props.editorObject.default);
    const [currentWorkerEnabled, setCurrentWorkerEnabled] = React.useState<boolean>(props.editorObject.enabled);
    const [currentWorkerMetadata, setCurrentWorkerMetadata] = React.useState<string>(
        props.extensionConfiguration.generalEditorMarkupFormat === EditorMarkupFormat.YAML
            ? yaml.stringify(props.editorObject.metadata)
            : JSON.stringify(props.editorObject.metadata, null, "\t")
    );
    const [nameError, setNameError] = React.useState<string>("");
    const [typeError, setTypeError] = React.useState<string>("");
    const [packageError, setPackageError] = React.useState<string>("");
    const [versionError, setVersionError] = React.useState<string>("");
    const [importPathError, setImportPathError] = React.useState<string>("");
    const [metadataError, setMetadataError] = React.useState<string>("");

    const checkName = (value: string): void => {
        if (IsHelper.isEmptyStringOrWhitespace(value)) {
            setNameError("Name cannot be blank");
            return;
        }

        if (value.includes(" ")) {
            setNameError("It is not recommended for name to have a space");
            return;
        }

        const copyCompareKeys: string[] = [...props.compareKeys];

        if (props.editorObject.index >= 0) {
            copyCompareKeys.splice(props.editorObject.index, 1);
        }

        if (copyCompareKeys.includes(value)) {
            setNameError("Duplicate worker name");
            return;
        }

        setNameError("");
    };

    const checkType = (value: string): void => {
        if (IsHelper.isEmptyStringOrWhitespace(value)) {
            setTypeError("Type cannot be blank");
            return;
        }

        if (value.includes(" ")) {
            setTypeError("It is not recommended for type to have a space");
            return;
        }

        setTypeError("");
    };

    const checkPackage = (value?: string): void => {
        if ((currentWorkerImportPath as string).includes("..") && !IsHelper.isEmptyStringOrWhitespace(value)) {
            setPackageError("Package cannot have a value with a relative path-based import path");
            return;
        }

        if (IsHelper.isEmptyStringOrWhitespace(value)) {
            setPackageError("Package cannot be blank");
            return;
        }

        if (value.includes(" ")) {
            setPackageError("Package cannot have a space");
            return;
        }

        setPackageError("");
    };

    const checkVersion = (value?: string): void => {
        if ((currentWorkerImportPath as string).includes("..") && !IsHelper.isEmptyStringOrWhitespace(value)) {
            setVersionError("Version cannot have a value with a relative path-based import path");
            return;
        }

        if (IsHelper.isEmptyStringOrWhitespace(value)) {
            setVersionError("Version cannot be blank");
            return;
        }

        if (value.includes(" ")) {
            setVersionError("Version cannot have a space");
            return;
        }

        if (!semver.valid(value) && value !== "workspace:*") {
            setVersionError("Version must be a workspace reference or a valid semver string");
            return;
        }

        setVersionError("");
    };

    const checkImportPath = (value: string): void => {
        if (IsHelper.isEmptyStringOrWhitespace(value)) {
            setImportPathError("Import path cannot be blank");
            return;
        }

        if (value.includes("..") && !IsHelper.isEmptyStringOrWhitespace(currentWorkerPackage)) {
            setPackageError("Package cannot have a value with a relative path-based import path");
        }

        if (value.includes("..") && IsHelper.isEmptyStringOrWhitespace(currentWorkerPackage)) {
            setPackageError("");
        }

        if (value.includes("..") && !IsHelper.isEmptyStringOrWhitespace(currentWorkerVersion)) {
            setVersionError("Version cannot have a value with a relative path-based import path");
        }

        if (value.includes("..") && IsHelper.isEmptyStringOrWhitespace(currentWorkerVersion)) {
            setVersionError("");
        }

        if (!value.includes("..") && IsHelper.isEmptyStringOrWhitespace(currentWorkerPackage)) {
            setPackageError("Package cannot be blank");
        }

        if (!value.includes("..") && IsHelper.isEmptyStringOrWhitespace(currentWorkerVersion)) {
            setVersionError("Version cannot be blank");
        }

        setImportPathError("");
    };

    const checkMetadata = (value: string): void => {
        if (IsHelper.isEmptyStringOrWhitespace(value)) {
            setMetadataError("Metadata cannot be blank and must at least be an empty object");
            return;
        }

        switch (props.extensionConfiguration.generalEditorMarkupFormat) {
            case EditorMarkupFormat.JSON:
                try {
                    JSON.parse(value);
                } catch {
                    setMetadataError("Metadata cannot be parsed and must be a valid JSON object");
                    return;
                }
                break;
            case EditorMarkupFormat.YAML:
                try {
                    yaml.parse(value);
                } catch {
                    setMetadataError("Metadata cannot be parsed and must be a valid YAML object");
                    return;
                }
                break;
        }

        setMetadataError("");
    };

    const disableEditorOk = (): boolean => {
        if (
            !IsHelper.isEmptyStringOrWhitespace(nameError) ||
            !IsHelper.isEmptyStringOrWhitespace(typeError) ||
            !IsHelper.isEmptyStringOrWhitespace(packageError) ||
            !IsHelper.isEmptyStringOrWhitespace(versionError) ||
            !IsHelper.isEmptyStringOrWhitespace(importPathError) ||
            !IsHelper.isEmptyStringOrWhitespace(metadataError)
        ) {
            return true;
        }

        let parsedMetadata: any;

        try {
            switch (props.extensionConfiguration.generalEditorMarkupFormat) {
                case EditorMarkupFormat.JSON:
                    parsedMetadata = JSON.parse(currentWorkerMetadata);
                    break;
                case EditorMarkupFormat.YAML:
                    parsedMetadata = yaml.parse(currentWorkerMetadata);
                    break;
            }
        } catch {
            return true;
        }

        const newObject: WorkerEditorObject = {
            index: originalEditorObject.index,
            name: currentWorkerName,
            type: currentWorkerType,
            package: currentWorkerPackage,
            version: currentWorkerVersion,
            importPath: currentWorkerImportPath,
            default: currentWorkerDefault,
            enabled: currentWorkerEnabled,
            metadata: parsedMetadata,
        };

        return isEqual(originalEditorObject, newObject);
    };

    return (
        <ModalWrapper>
            <div>
                <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full">
                    <img className="mx-auto" alt="OmniHive Logo" src={props.imageSources.beeDark} />
                </div>
                <div className="mt-3 sm:mt-5 max-h-96 overscroll-y-contain overflow-y-auto pl-3 pr-3">
                    <div>
                        <div className={FormStyles.formInputContainer}>
                            <label className={FormStyles.formInputLabel}>Name</label>
                            <input
                                className={FormStyles.formInput}
                                style={nameError !== "" ? { border: "2px solid red" } : {}}
                                type="text"
                                name="name"
                                value={currentWorkerName}
                                onChange={(e) => {
                                    setCurrentWorkerName(e.target.value);
                                    checkName(e.target.value);
                                }}
                            />
                            {nameError !== "" && <div className="pt-2 text-red-600">{nameError}</div>}
                        </div>
                        <div className={FormStyles.formInputContainer}>
                            <label className={FormStyles.formInputLabel}>Type</label>
                            <select
                                className={FormStyles.formInput}
                                style={typeError !== "" ? { border: "2px solid red" } : {}}
                                name="type"
                                value={currentWorkerType}
                                onChange={(e) => {
                                    setCurrentWorkerType(e.target.value);
                                    checkType(e.target.value);
                                }}
                            >
                                <option value="cache">Cache</option>
                                <option value="config">Config</option>
                                <option value="custom">Custom</option>
                                <option value="date">Date</option>
                                <option value="database">Database</option>
                                <option value="dataLifecycleFunction">Data Lifecycle Function</option>
                                <option value="encryption">Encryption</option>
                                <option value="error">Error</option>
                                <option value="feature">Feature</option>
                                <option value="fileSystem">File System</option>
                                <option value="graphBuilder">Graph Builder</option>
                                <option value="graphEndpointFunction">Graph Endpoint Function</option>
                                <option value="log">Log</option>
                                <option value="pubSubServer">Pub/Sub Server</option>
                                <option value="pubSubClient">Pub/Sub Client</option>
                                <option value="restEndpointFunction">REST Endpoint Function</option>
                                <option value="server">Server</option>
                                <option value="storage">Storage</option>
                                <option value="taskFunction">Task Runner Function</option>
                                <option value="token">Token</option>
                                <option value="user">User</option>
                            </select>
                            {typeError !== "" && <div className="pt-2 text-red-600">{typeError}</div>}
                        </div>
                        <div className={FormStyles.formInputContainer}>
                            <label className={FormStyles.formInputLabel}>Package</label>
                            <input
                                className={FormStyles.formInput}
                                style={packageError !== "" ? { border: "2px solid red" } : {}}
                                type="text"
                                name="type"
                                value={currentWorkerPackage}
                                onChange={(e) => {
                                    setCurrentWorkerPackage(e.target.value);
                                    checkPackage(e.target.value);
                                }}
                            />
                            {packageError !== "" && <div className="pt-2 text-red-600">{packageError}</div>}
                        </div>
                        <div className={FormStyles.formInputContainer}>
                            <label className={FormStyles.formInputLabel}>Version</label>
                            <input
                                className={FormStyles.formInput}
                                style={versionError !== "" ? { border: "2px solid red" } : {}}
                                type="text"
                                name="version"
                                value={currentWorkerVersion}
                                onChange={(e) => {
                                    setCurrentWorkerVersion(e.target.value);
                                    checkVersion(e.target.value);
                                }}
                            />
                            {versionError !== "" && <div className="pt-2 text-red-600">{versionError}</div>}
                        </div>
                        <div className={FormStyles.formInputContainer}>
                            <label className={FormStyles.formInputLabel}>Import Path</label>
                            <input
                                className={FormStyles.formInput}
                                style={importPathError !== "" ? { border: "2px solid red" } : {}}
                                type="text"
                                name="package"
                                value={currentWorkerImportPath}
                                onChange={(e) => {
                                    setCurrentWorkerImportPath(e.target.value);
                                    checkImportPath(e.target.value);
                                }}
                            />
                            {importPathError !== "" && <div className="pt-2 text-red-600">{importPathError}</div>}
                        </div>
                        <div className={FormStyles.formInputContainer}>
                            <label className={FormStyles.formInputLabel}>Default</label>
                            <div className="pl-4 pt-1 flex flex-row space-x-4 w-full text-gray-700">
                                <div>
                                    <input
                                        type="radio"
                                        name="default"
                                        value="true"
                                        checked={currentWorkerDefault === true}
                                        onChange={(e) => setCurrentWorkerDefault(true)}
                                    />
                                </div>
                                <div>
                                    <span>True</span>
                                </div>
                                <div>
                                    <input
                                        type="radio"
                                        name="default"
                                        value="false"
                                        checked={currentWorkerDefault === false}
                                        onChange={(e) => setCurrentWorkerDefault(false)}
                                    />
                                </div>
                                <div>
                                    <span>False</span>
                                </div>
                            </div>
                        </div>
                        <div className={FormStyles.formInputContainer}>
                            <label className={FormStyles.formInputLabel}>Enabled</label>
                            <div className="pl-4 pt-1 flex flex-row space-x-4 w-full text-gray-700">
                                <div>
                                    <input
                                        type="radio"
                                        name="enabled"
                                        value="true"
                                        checked={currentWorkerEnabled === true}
                                        onChange={(e) => setCurrentWorkerEnabled(true)}
                                    />
                                </div>
                                <div>
                                    <span>True</span>
                                </div>
                                <div>
                                    <input
                                        type="radio"
                                        name="enabled"
                                        value="false"
                                        checked={currentWorkerEnabled === false}
                                        onChange={(e) => setCurrentWorkerEnabled(false)}
                                    />
                                </div>
                                <div>
                                    <span>False</span>
                                </div>
                            </div>
                        </div>
                        <div className={FormStyles.formInputContainer}>
                            <label className={FormStyles.formInputLabel}>Metadata</label>
                            <AceEditor
                                wrapEnabled={true}
                                height="600px"
                                width="95%"
                                mode={
                                    props.extensionConfiguration.generalEditorMarkupFormat === EditorMarkupFormat.YAML
                                        ? "yaml"
                                        : "json"
                                }
                                theme="tomorrow_night"
                                name="metadata"
                                highlightActiveLine={true}
                                style={metadataError !== "" ? { border: "2px solid red" } : {}}
                                onLoad={(editor) => {
                                    switch (props.extensionConfiguration.generalEditorMarkupFormat) {
                                        case EditorMarkupFormat.JSON:
                                            editor
                                                .getSession()
                                                .setValue(JSON.stringify(props.editorObject.metadata, null, "\t"));
                                            break;
                                        case EditorMarkupFormat.YAML:
                                            editor.getSession().setValue(yaml.stringify(props.editorObject.metadata));
                                            break;
                                    }
                                }}
                                onChange={(e) => {
                                    setCurrentWorkerMetadata(e);
                                    checkMetadata(e);
                                }}
                                setOptions={{ useWorker: false }}
                                editorProps={{ $blockScrolling: true }}
                            />
                            {metadataError !== "" && <div className="pt-2 text-red-600">{metadataError}</div>}
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex flex-row">
                {disableEditorOk() && (
                    <button
                        disabled={true}
                        type="button"
                        className="cursor-not-allowed disabled:opacity-50 mr-2 ml-2 mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-omnihive-orange text-base font-medium text-white hover:bg-omnihive-orangeHover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-900"
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
                                name: currentWorkerName,
                                type: currentWorkerType,
                                package: currentWorkerPackage,
                                version: currentWorkerVersion,
                                importPath: currentWorkerImportPath,
                                default: currentWorkerDefault,
                                enabled: currentWorkerEnabled,
                                metadata:
                                    props.extensionConfiguration.generalEditorMarkupFormat === EditorMarkupFormat.YAML
                                        ? yaml.parse(currentWorkerMetadata)
                                        : JSON.parse(currentWorkerMetadata),
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
                {props.allowDelete && (
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
