import React from "react";
import { ReactPropsModel } from "../../models/ReactPropsModel";
import GraphiQL from "graphiql";
import { AdminResponse } from "@withonevision/omnihive-core/models/AdminResponse";
import { AdminEventType } from "@withonevision/omnihive-core/enums/AdminEventType";
import { RegisteredServerModel } from "../../models/RegisteredServerModel";
import socketio, { Socket } from "socket.io-client";
import { ServerStatus } from "@withonevision/omnihive-core/enums/ServerStatus";
import { IsHelper } from "@withonevision/omnihive-core/helpers/IsHelper";

type Props = {
    props: ReactPropsModel;
};

let socket: Socket;
let socketReconnectInProgress: boolean = false;

export const GraphBrowser: React.FC<Props> = ({ props }): React.ReactElement => {
    const [headers, setHeaders] = React.useState<string>("");
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
            getKey();
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
            AdminEventType.StatusResponse,
            (message: AdminResponse<{ serverStatus: ServerStatus; serverError: any }>) => {
                if (message.serverGroupId !== server.serverGroupId) {
                    return;
                }

                switch (message.data.serverStatus) {
                    case ServerStatus.Admin:
                        setBeeImg(props.imageSources.beeLightOrange);
                        setShowCommands(false);
                        break;
                    case ServerStatus.Error:
                        setBeeImg(props.imageSources.beeLightRed);
                        setShowCommands(false);
                        break;
                    case ServerStatus.Offline:
                        setBeeImg(props.imageSources.beeLightRed);
                        setShowCommands(false);
                        break;
                    case ServerStatus.Online:
                        setBeeImg(props.imageSources.beeLightGreen);
                        setShowCommands(true);
                        break;
                    case ServerStatus.Rebuilding:
                        setBeeImg(props.imageSources.beeLightYellow);
                        setShowCommands(false);
                        break;
                    case ServerStatus.Unknown:
                        setBeeImg(props.imageSources.beeLightGrey);
                        setShowCommands(false);
                        break;
                    default:
                        setBeeImg(props.imageSources.beeLightGrey);
                        setShowCommands(false);
                        break;
                }
            }
        );

        socket.on(
            AdminEventType.AccessTokenResponse,
            (message: AdminResponse<{ hasWorker: boolean; token: string }>) => {
                if (message.serverGroupId !== server.serverGroupId) {
                    return;
                }

                if (!message.requestComplete || IsHelper.isNullOrUndefined(message.data)) {
                    return;
                }

                setShowCommands(true);

                if (!message.data.hasWorker) {
                    setHeaders("");
                    return;
                }

                setHeaders(`{"x-omnihive-access": "${message.data.token}"}`);
            }
        );

        socket.connect();
    }, []);

    React.useEffect(() => {
        return () => {
            socket.disconnect();
        };
    }, []);

    const getKey = () => {
        socket.emit(AdminEventType.AccessTokenRequest, {
            adminPassword: server.adminPassword,
            serverGroupId: server.serverGroupId,
        });
    };

    return (
        <div className="flex flex-col h-screen">
            <div className="w-full mb-2 flex justify-between items-center shadow-md h-20">
                <div className="flex items-center ml-5">
                    <div className="pr-5">
                        <img className="align-middle h-12" alt="OmniHive Logo" src={beeImg} />
                    </div>
                    <div>
                        <span className="font-bold text-base text-white">
                            OMNIHIVE GRAPH BROWSER - {props.panelData.graphUrl}
                        </span>
                    </div>
                </div>
                {showCommands && (
                    <div className="mt-2 mr-10">
                        <button type="button" onClick={getKey} title="Refresh Token">
                            <img src={props.imageSources.key} alt="key" className="h-10" />
                        </button>
                    </div>
                )}
            </div>
            <div className="w-full h-5/6 flex-1 overflow-y-auto pt-5 m-auto">
                <div className="w-full h-5/6">
                    <GraphiQL
                        defaultQuery={""}
                        shouldPersistHeaders={true}
                        headerEditorEnabled={true}
                        headers={headers}
                        fetcher={async (graphQLParams) => {
                            let argHeaders = {
                                Accept: "application/json",
                                "Content-Type": "application/json",
                            };
                            if (!IsHelper.isNullOrUndefinedOrEmptyStringOrWhitespace(headers)) {
                                argHeaders = {
                                    ...JSON.parse(headers),
                                    ...argHeaders,
                                };
                            }

                            const data = await fetch(props.panelData.graphUrl, {
                                method: "POST",
                                headers: argHeaders,
                                body: JSON.stringify(graphQLParams),
                            });
                            return data.json().catch(() => "");
                        }}
                    />
                </div>
            </div>
        </div>
    );
};
