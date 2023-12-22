/// <reference path="../../../built/pxteditor.d.ts" />
import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { ProgressBar } from "react-common/components/controls/ProgressBar";

// This is something I want to do eventually. The iframe should be able to work with a redux store
// import { connect } from 'react-redux';

// left  these here commented out because these states are something that might be wanted for generic cases
// interface CloudState {
//     [headerId: string]: pxt.cloud.CloudStatus;
// }

// interface AuthState {
//     signedIn: boolean;
//     profile?: pxt.auth.UserProfile;
//     preferences?: pxt.auth.UserPreferences;
// }
// export const cloudLocalStoreKey = "-SHOWN-LOGIN-PROMPT";


interface MakeCodeFrameProps {
    pageSourceUrl: string;
    highContrast?: boolean;
    onFrameOpen: () => void;
    onFrameClose: () => void;
    tutorialEventHandler?: (event: pxt.editor.EditorMessageTutorialEventRequest) => void;
    // TODO: make it so the iframe can work with a redux store
}

type FrameState = "loading" | "no-project" | "opening-project" | "project-open" | "closing-project";

interface PendingMessage {
    original: pxt.editor.EditorMessageRequest;
    handler: (response: any) => void;
}

export const MakeCodeFrame: React.FC<MakeCodeFrameProps> =
    ( { pageSourceUrl,
        highContrast,
        onFrameClose,
        onFrameOpen
    } ) => {
    let ref: HTMLIFrameElement | undefined;
    const messageQueue: pxt.editor.EditorMessageRequest[] = [];
    let nextId: number = 0;
    let pendingMessages: {[index: string]: PendingMessage} = {};
    const [frameState, setFrameState] = useState<FrameState>("loading");
    const [loadPercent, setLoadPercent] = useState(0);
    const [workspaceReady, setWorkspaceReady] = useState(false);

    let frameRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        // logic we want to do when the iframe is loaded
        const root = document.getElementById("root");
        if (ref && ref.contentWindow) {
            window.addEventListener("message", onMessageReceived);
            ref.addEventListener("load", handleFrameReload)

            if (root) pxt.BrowserUtils.addClass(root, "editor");
        }

        // logic we want when the iframe unmounts
        return () => {
            window.removeEventListener("message", onMessageReceived);
            if (root) pxt.BrowserUtils.removeClass(root, "editor");
        }
    }, [])

    useEffect(() => {
        sendMessageAsync({
            type: "pxteditor",
            action: "sethighcontrast",
            on: highContrast
        }  as pxt.editor.EditorMessageSetHighContrastRequest);
    }, [highContrast])


    useEffect(() => {
        if (frameState === "project-open" /*&& this.props.save*/) {
            setFrameState("closing-project");
            onFrameClose();
        }
        else if (frameState === "no-project") {
            setFrameState("opening-project");
            onFrameOpen();
        }
    }, [frameState]);


    const handleFrameReload = () => {
        setFrameState("loading")
    }

    const onMessageReceived = (event: MessageEvent) => {
        const data = event.data as pxt.editor.EditorMessageRequest;
        if (frameState === "opening-project") setLoadPercent(Math.min((loadPercent || 0) + 7, 95));

        if (data.type === "pxteditor" && data.id && pendingMessages[data.id]) {
            const pending = pendingMessages[data.id];
            pending.handler(data);
            delete pendingMessages[data.id];
            return;
        }

        switch (data.action) {
            case "newproject":
                if (!workspaceReady) {
                    setWorkspaceReady(true);
                    sendMessageAsync(); // Flush message queue
                    // this.props.onWorkspaceReady((message) => this.sendMessageAsync(message));
                }
                if (frameState === "loading") {
                    setFrameState("no-project");
                }
                break;
            case "tutorialevent":
                // for the more general case, we will want to pass in a tutorialEventHandler
                // this might not be needed for the teacher tool in particular
                // this.handleTutorialEvent(data as pxt.editor.EditorMessageTutorialEventRequest);
                break;
            case "projectcloudstatus": {
                const msg = data as pxt.editor.EditorMessageProjectCloudStatus;
                // this.props.dispatchSetCloudStatus(msg.headerId, msg.status);
                break;
            }
            default:
                // console.log(JSON.stringify(data, null, 4));
        }
    }

    const sendMessageAsync = (message?: any) => {
        return new Promise(resolve => {
            const sendMessageCore = (message: any) => {
                message.response = true;
                message.id = nextId++ + "";
                pendingMessages[message.id] = {
                    original: message,
                    handler: resolve
                };
                ref!.contentWindow!.postMessage(message, "*");
            }

            if (ref) {
                if (!workspaceReady) {
                    messageQueue.push(message);
                }
                else {
                    while (messageQueue.length) {
                        sendMessageCore(messageQueue.shift());
                    }
                    if (message) sendMessageCore(message);
                }
            }
        });
    }

    const openingProject = frameState === "opening-project";
    const showLoader = openingProject || frameState === "closing-project";
    /* eslint-disable @microsoft/sdl/react-iframe-missing-sandbox */
    return <div className="makecode-frame-outer" style={{ display: "block" }}>
        <div className={`makecode-frame-loader ${showLoader ? "" : "hidden"}`}>
            {openingProject && <ProgressBar className="makecode-frame-loader-bar" value={loadPercent! / 100} />}
            <div className="makecode-frame-loader-text">{lf("Loading...")}</div>
        </div>
        <iframe className="makecode-frame" src={pageSourceUrl} title={"title"} ref={frameRef}></iframe>
    </div>
    /* eslint-enable @microsoft/sdl/react-iframe-missing-sandbox */
}