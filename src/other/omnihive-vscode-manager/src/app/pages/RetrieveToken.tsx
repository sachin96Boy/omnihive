import { AdminEventType, AdminResponse, IsHelper, ServerStatus } from "@withonevision/omnihive-core-cjs";
import React from "react";
import { CopyToClipboard } from "react-copy-to-clipboard";
import socketio, { Socket } from "socket.io-client";
import { ReactPropsModel } from "../../models/ReactPropsModel";
import { RegisteredServerModel } from "../../models/RegisteredServerModel";
import { ToastWarning } from "../components/ToastWarning";

type Props = {
    props: ReactPropsModel;
};

let socket: Socket;
let socketReconnectInProgress: boolean = false;

export const RetrieveToken: React.FC<Props> = ({ props }): React.ReactElement => {
    const [token, setToken] = React.useState<string>("");
    const [showCopiedToClipboard, setShowCopiedToClipboard] = React.useState<boolean>(false);
    const [beeImg, setBeeImg] = React.useState<string>(props.imageSources.beeLight);
    const [showCommands, setShowCommands] = React.useState<boolean>(false);

    const server = props.registeredServers.find(
        (server: RegisteredServerModel) => server.label === props.panelData.serverLabel
    );

    React.useEffect(() => {
        const url: URL = new URL(server.address);
        socket = socketio(`${url.origin}/${server.serverGroupId}`, {
            path: `${url.pathname === "/" ? "" : url.pathname}/socket.io`,
            transports: ["websocket"],
        });

        socket.on("connect", () => {
            socketReconnectInProgress = false;
            socket.emit(AdminEventType.StatusRequest, {
                adminPassword: server.adminPassword,
                serverGroupId: server.serverGroupId,
            });
        });

        socket.on("connect_error", () => {
            if (socketReconnectInProgress) {
                return;
            }

            socketReconnectInProgress = true;
            setBeeImg(props.imageSources.beeLightRed);
            setShowCommands(false);
            setTimeout(() => {
                socket.connect();
            }, 1000);
        });

        socket.on("disconnect", () => {
            if (socketReconnectInProgress) {
                return;
            }

            socketReconnectInProgress = true;
            setBeeImg(props.imageSources.beeLightRed);
            setShowCommands(false);
            setTimeout(() => {
                socket.connect();
            }, 1000);
        });

        socket.on(
            AdminEventType.AccessTokenResponse,
            (message: AdminResponse<{ serverLabel: string; hasWorker: boolean; token: string }>) => {
                if (message.serverGroupId !== server.serverGroupId) {
                    return;
                }

                if (!message.requestComplete || IsHelper.isNullOrUndefined(message.data)) {
                    setToken(message.requestError);
                    return;
                }

                if (!message.data.hasWorker) {
                    setToken("No Token Worker Available on This Server or Server is Offline");
                    return;
                }

                setToken(message.data.token);
            }
        );

        socket.on(
            AdminEventType.StatusResponse,
            (message: AdminResponse<{ serverStatus: ServerStatus; serverError: any }>) => {
                if (message.serverGroupId !== server.serverGroupId) {
                    return;
                }

                switch (message.data.serverStatus) {
                    case ServerStatus.Admin:
                        setBeeImg(props.imageSources.beeLightOrange);
                        setShowCommands(false);
                        setToken("Server is in admin mode");
                        break;
                    case ServerStatus.Error:
                        setBeeImg(props.imageSources.beeLightRed);
                        setShowCommands(false);
                        setToken("Server is offline");
                        break;
                    case ServerStatus.Offline:
                        setBeeImg(props.imageSources.beeLightRed);
                        setShowCommands(false);
                        setToken("Server is offline");
                        break;
                    case ServerStatus.Online:
                        setBeeImg(props.imageSources.beeLightGreen);
                        getKey();
                        setShowCommands(true);
                        break;
                    case ServerStatus.Rebuilding:
                        setBeeImg(props.imageSources.beeLightYellow);
                        setShowCommands(false);
                        setToken("Server is rebuilding");
                        break;
                    case ServerStatus.Unknown:
                        setBeeImg(props.imageSources.beeLightGrey);
                        setShowCommands(false);
                        setToken("");
                        break;
                    default:
                        setBeeImg(props.imageSources.beeLightGrey);
                        setShowCommands(false);
                        setToken("");
                        break;
                }
            }
        );

        socket.connect();
    }, []);

    React.useEffect(() => {
        return () => {
            socket.disconnect();
        };
    }, []);

    const copiedToClipboard = () => {
        setShowCopiedToClipboard(true);

        setTimeout(() => {
            setShowCopiedToClipboard(false);
        }, props.extensionConfiguration.generalAlertSuccessTimeout);
    };

    const getKey = () => {
        socket.emit(AdminEventType.AccessTokenRequest, {
            adminPassword: server.adminPassword,
            serverGroupId: server.serverGroupId,
        });
    };

    return (
        <>
            {showCopiedToClipboard && (
                <ToastWarning
                    show={true}
                    message={"Token copied to clipboard!"}
                    warningPng={props.imageSources.warning}
                />
            )}
            <div className="flex flex-col h-screen">
                <div className="w-full mb-2 flex justify-between items-center shadow-md h-20">
                    <div className="flex items-center ml-5">
                        <div className="pr-5">
                            <img className="align-middle h-12" alt="OmniHive Logo" src={beeImg} />
                        </div>
                        <div>
                            <span className="font-bold text-base text-white">
                                OMNIHIVE ACCESS TOKEN - {props.panelData.serverLabel}
                            </span>
                        </div>
                    </div>
                    {!showCopiedToClipboard && showCommands && (
                        <div className="mt-2 mr-10">
                            <CopyToClipboard text={token} onCopy={copiedToClipboard}>
                                <button className="mr-4" type="button" title="Copy To Clipboard">
                                    <img src={props.imageSources.clipboard} alt="clipboard" className="h-10" />
                                </button>
                            </CopyToClipboard>
                            <button type="button" onClick={getKey} title="Refresh Token">
                                <img src={props.imageSources.key} alt="key" className="h-10" />
                            </button>
                        </div>
                    )}
                </div>
                <div className="h-auto w-1/2 flex-1 overflow-y-auto pt-5 m-auto">
                    <div className="box border rounded flex flex-col shadow bg-white">
                        <div className="bg-omnihive-orange rounded px-3 py-2 border-b">
                            <h3 className=" text-sm text-black font-medium">Token</h3>
                        </div>
                        <textarea
                            rows={7}
                            className="text-black flex-1 p-2 m-1 bg-transparent"
                            value={token}
                            readOnly={true}
                        ></textarea>
                    </div>
                </div>
            </div>
        </>
    );
};
