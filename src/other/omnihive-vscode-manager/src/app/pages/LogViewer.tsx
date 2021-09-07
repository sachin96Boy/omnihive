import { OmniHiveLogLevel } from "@withonevision/omnihive-core/enums/OmniHiveLogLevel";
import Parser from "html-react-parser";
import React from "react";
import { ReactPropsModel } from "../../models/ReactPropsModel";
import { RegisteredServerModel } from "../../models/RegisteredServerModel";
import { ServerStatus } from "@withonevision/omnihive-core/enums/ServerStatus";
import { serializeError } from "serialize-error";
import { AdminResponse } from "@withonevision/omnihive-core/models/AdminResponse";
import { AdminEventType } from "@withonevision/omnihive-core/enums/AdminEventType";
import socketio, { Socket } from "socket.io-client";
import { IsHelper } from "@withonevision/omnihive-core/helpers/IsHelper";

type Props = {
    props: ReactPropsModel;
};

let socket: Socket;
let socketReconnectInProgress: boolean = false;

export const LogViewer: React.FC<Props> = ({ props }): React.ReactElement => {
    const bottomRef = React.useRef<HTMLDivElement>();

    const [beeImg, setBeeImg] = React.useState<string>(props.imageSources.beeLight);
    const [displayItems, setDisplayItems] = React.useState<string[]>([]);
    const [pauseScroll, setPauseScroll] = React.useState<boolean>(false);

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
            socket.emit(AdminEventType.StartLogRequest, {
                adminPassword: server.adminPassword,
                serverGroupId: server.serverGroupId,
            });

            let newLine: string = `<span style="color:limegreen;">info:&nbsp;&nbsp;Connected and awaiting log messages...<span><br />`;
            setDisplayItems((currentLogArray) => [...currentLogArray, newLine]);
        });

        socket.on("connect_error", () => {
            if (socketReconnectInProgress) {
                return;
            }

            socketReconnectInProgress = true;
            setBeeImg(props.imageSources.beeLightRed);
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
            setTimeout(() => {
                socket.connect();
            }, 1000);
        });

        socket.on(
            AdminEventType.StatusResponse,
            (message: AdminResponse<{ serverStatus: ServerStatus; serverError: any }>) => {
                if (message.serverGroupId !== server.serverGroupId) {
                    return;
                }

                if (message.data.serverStatus === ServerStatus.Admin && message.data.serverError) {
                    const newLine: string = `<span style="color:red;">admin error:&nbsp;&nbsp;${JSON.stringify(
                        serializeError(message.data.serverError)
                    )}<span><br />`;
                    setDisplayItems((currentLogArray) => [...currentLogArray, newLine]);
                }

                switch (message.data.serverStatus) {
                    case ServerStatus.Admin:
                        setBeeImg(props.imageSources.beeLightOrange);
                        break;
                    case ServerStatus.Error:
                        setBeeImg(props.imageSources.beeLightRed);
                        break;
                    case ServerStatus.Offline:
                        setBeeImg(props.imageSources.beeLightRed);
                        break;
                    case ServerStatus.Online:
                        setBeeImg(props.imageSources.beeLightGreen);
                        break;
                    case ServerStatus.Rebuilding:
                        setBeeImg(props.imageSources.beeLightYellow);
                        break;
                    case ServerStatus.Unknown:
                        setBeeImg(props.imageSources.beeLightGrey);
                        break;
                    default:
                        setBeeImg(props.imageSources.beeLightGrey);
                        break;
                }
            }
        );

        socket.on(
            AdminEventType.LogResponse,
            (
                message: AdminResponse<{
                    logLevel: OmniHiveLogLevel;
                    timestamp: string;
                    osName: string;
                    logString: string;
                }>
            ) => {
                if (message.serverGroupId !== server.serverGroupId) {
                    return;
                }

                if (!message.requestComplete || IsHelper.isNullOrUndefined(message.data)) {
                    return;
                }

                let newLine: string = "";

                switch (message.data.logLevel) {
                    case OmniHiveLogLevel.Warn:
                        newLine = `<span style="color:yellow;">warn:&nbsp;&nbsp;${message.data.timestamp}&nbsp;&nbsp;${message.data.osName}&nbsp;&nbsp;${message.data.logString}<span><br />`;
                        break;
                    case OmniHiveLogLevel.Error:
                        newLine = `<span style="color:red;">error:&nbsp;&nbsp;${message.data.timestamp}&nbsp;&nbsp;${message.data.osName}&nbsp;&nbsp;${message.data.logString}<span><br />`;
                        break;
                    default:
                        newLine = `<span style="color:blue;">info:</span>&nbsp;&nbsp;<span style="color: #c408c4;">${message.data.timestamp}&nbsp;&nbsp;${message.data.osName}</span>&nbsp;&nbsp;<span>${message.data.logString}<span><br />`;
                        break;
                }

                setDisplayItems((currentLogArray) => [...currentLogArray, newLine]);
            }
        );

        socket.connect();
    }, []);

    React.useEffect(() => {
        scrollToBottom();
    }, [displayItems]);

    React.useEffect(() => {
        return () => {
            socket.emit(AdminEventType.StopLogRequest, {
                adminPassword: server.adminPassword,
                serverGroupId: server.serverGroupId,
            });
            socket.disconnect();
        };
    }, []);

    const pauseClicked = () => {
        setPauseScroll(true);
    };

    const playClicked = () => {
        setPauseScroll(false);
        scrollToBottom(true);
    };

    const scrollToBottom = (force: boolean = false) => {
        if (
            !IsHelper.isNullOrUndefined(bottomRef) &&
            !IsHelper.isNullOrUndefined(bottomRef.current) &&
            (!pauseScroll || force)
        ) {
            bottomRef.current.scrollIntoView();
        }
    };

    return (
        <div className="flex flex-col h-screen">
            <div className="w-full mb-2 flex justify-between items-center shadow-md h-20 mt-1">
                <div className="flex items-center ml-5">
                    <div className="pr-5">
                        <img className="align-middle h-12" alt="OmniHive Logo" src={beeImg} />
                    </div>
                    <div>
                        <span className="font-bold text-base text-white">
                            OMNIHIVE LOG - {props.panelData.serverLabel}
                        </span>
                    </div>
                </div>
                <div className="mt-2 mr-10">
                    {pauseScroll && (
                        <button type="button" onClick={playClicked} title="Continue Scrolling">
                            <img src={props.imageSources.play} alt="play" className="h-10" />
                        </button>
                    )}
                    {!pauseScroll && (
                        <button type="button" onClick={pauseClicked} title="Pause Scrolling">
                            <img src={props.imageSources.pause} alt="pause" className="h-10" />
                        </button>
                    )}
                </div>
            </div>
            <div className="h-auto w-full flex-1 overflow-y-auto">
                {displayItems &&
                    displayItems.map((item, index) => (
                        <p key={index}>
                            <span
                                style={{
                                    minWidth: 30,
                                    width: 30,
                                    color: "grey",
                                    display: "inline-block",
                                    paddingRight: 5,
                                    borderRight: "1px dotted grey",
                                    marginRight: 5,
                                }}
                            >
                                {index + 1}
                            </span>
                            {Parser(item)}
                        </p>
                    ))}
                <div ref={bottomRef}></div>
            </div>
        </div>
    );
};
