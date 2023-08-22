import * as React from "react";
import * as workspace from "./workspace";
import { Button } from "../../react-common/components/controls/Button";

interface TimeMachineProps {
    onTimestampSelect: (timestamp: number) => void;
    text: pxt.workspace.ScriptText;
    history: pxt.workspace.HistoryEntry[];
}

interface State {
    timestamp: number;
    editor: string;
}

interface FunctionWrapper<U> {
    impl: U;
}

interface PendingMessage {
    original: pxt.editor.EditorMessageRequest;
    handler: (response: any) => void;
}

export const TimeMachine = (props: TimeMachineProps) => {
    const { onTimestampSelect, text, history } = props;

    const [selected, setSelected] = React.useState<State>();
    const [importProject, setImportProject] = React.useState<FunctionWrapper<(text: pxt.workspace.ScriptText) => Promise<void>>>();

    const handleRef = React.useRef<HTMLDivElement>();
    const containerRef = React.useRef<HTMLDivElement>();
    const backgroundRef = React.useRef<HTMLDivElement>();
    const iframeRef = React.useRef<HTMLIFrameElement>();

    React.useEffect(() => {
        let inGesture = false;

        const onGestureEnd = (e: PointerEvent) => {
            if (!inGesture) return;
            updatePosition(e);
            inGesture = false;

            const truncatedHistory = history.slice(2);
            const bounds = backgroundRef.current.getBoundingClientRect();

            const y = e.clientY - bounds.top;

            const percentage = Math.min(1, Math.max(y / bounds.height, 0));
            const entry = truncatedHistory[Math.round(percentage * truncatedHistory.length)];

            if (entry && entry.timestamp !== selected?.timestamp) {
                const printFiles = applyUntilTimestamp(text, history, entry.timestamp);
                const config = JSON.parse(printFiles["pxt.json"]) as pxt.PackageConfig;

                importProject.impl(printFiles)

                setSelected({
                    timestamp: entry.timestamp,
                    editor: config.preferredEditor !== pxt.BLOCKS_PROJECT_NAME ? "typescript" : "blocks"
                });
            }
        }

        const updatePosition = (e: PointerEvent) => {
            if (!inGesture) return;
            const bounds = backgroundRef.current.getBoundingClientRect();
            const y = e.clientY - bounds.top;

            const percentage = Math.min(1, Math.max(y / bounds.height, 0));

            const offset = Math.round(percentage * (history.length - 2)) * (bounds.height / (history.length - 2));

            handleRef.current.style.top = offset + "px";
        };

        const pointerdown = (e: PointerEvent) => {
            inGesture = true;
            updatePosition(e);
        };

        const pointerup = (e: PointerEvent) => {
            onGestureEnd(e);
        };

        const pointermove = (e: PointerEvent) => {
            updatePosition(e);
        };

        const pointerleave = (e: PointerEvent) => {
            onGestureEnd(e);
        };

        const container = containerRef.current;

        container.addEventListener("pointerdown", pointerdown);
        container.addEventListener("pointerup", pointerup);
        container.addEventListener("pointermove", pointermove);
        container.addEventListener("pointerleave", pointerleave);

        return () => {
            container.removeEventListener("pointerdown", pointerdown);
            container.removeEventListener("pointerup", pointerup);
            container.removeEventListener("pointermove", pointermove);
            container.removeEventListener("pointerleave", pointerleave);
        }
    }, [history, selected, importProject]);

    React.useEffect(() => {
        const iframe = iframeRef.current;
        let nextId = 1;
        let workspaceReady: boolean;
        const messageQueue: pxt.editor.EditorMessageRequest[] = [];
        const pendingMessages: {[index: string]: PendingMessage} = {};

        const postMessageCore = (message: pxt.editor.EditorMessageRequest | pxt.editor.EditorMessageResponse) => {
            iframe.contentWindow!.postMessage(message, "*");
        };

        const sendMessageAsync = (message?: pxt.editor.EditorMessageRequest) => {
            return new Promise(resolve => {
                const sendMessageCore = (message: any) => {
                    message.response = true;
                    message.id = "time_machine_" + nextId++;
                    pendingMessages[message.id] = {
                        original: message,
                        handler: resolve
                    };
                    postMessageCore(message);
                }

                if (!workspaceReady) {
                    if (message) messageQueue.push(message);
                }
                else {
                    while (messageQueue.length) {
                        sendMessageCore(messageQueue.shift());
                    }
                    if (message) sendMessageCore(message);
                }
            });
        };

        const onMessageReceived = (event: MessageEvent) => {
            const data = event.data as pxt.editor.EditorMessageRequest;

            if (data.type === "pxteditor" && data.id && pendingMessages[data.id]) {
                const pending = pendingMessages[data.id];
                pending.handler(data);
                delete pendingMessages[data.id];
                return;
            }

            switch (data.action) {
                case "newproject":
                    workspaceReady = true;
                    sendMessageAsync();
                    break;
                case "workspacesync":
                    postMessageCore({
                        type: "pxthost",
                        id: data.id,
                        success: true,
                        projects: []
                    } as pxt.editor.EditorWorkspaceSyncResponse);
                    break;
            }
        };

        setImportProject({
            impl: async (project: pxt.workspace.ScriptText) => {
                await sendMessageAsync({
                    type: "pxteditor",
                    action: "importproject",
                    project: {
                        text: project
                    }
                } as pxt.editor.EditorMessageImportProjectRequest)
            }
        });

        window.addEventListener("message", onMessageReceived);
        return () => {
            window.removeEventListener("message", onMessageReceived);
        };
    }, [])

    const onGoPressed = React.useCallback(() => {
        onTimestampSelect(selected.timestamp);
    }, [selected, onTimestampSelect]);

    const url = `${window.location.origin + window.location.pathname}?readonly=1&controller=1&skillsMap=1&noproject=1&nocookiebanner=1`;

    return (
        <div className="time-machine">
            <div className="time-machine-timeline">
                <div className="time-machine-label">
                    {pxt.U.lf("Past")}
                </div>
                <div className="time-machine-timeline-slider" ref={containerRef}>
                    <div className="time-machine-timeline-slider-handle" ref={handleRef}/>
                    <div className="time-machine-timeline-slider-background" ref={backgroundRef} />
                </div>
                <div className="time-machine-label">
                    {pxt.U.lf("Present")}
                </div>
                <Button
                    className="primary"
                    label={pxt.U.lf("Go")}
                    title={pxt.U.lf("Restore editor to selected version")}
                    onClick={onGoPressed}
                />
            </div>
            <div className="time-machine-preview">
                <iframe
                    ref={iframeRef}
                    frameBorder="0"
                    aria-label={lf("Project preview")}
                    sandbox="allow-popups allow-forms allow-scripts allow-same-origin allow-modals"
                    src={url}
                />
            </div>
        </div>
    );
}

function applyUntilTimestamp(text: pxt.workspace.ScriptText, history: pxt.workspace.HistoryEntry[], timestamp: number) {
    let currentText = { ...text };

    for (let i = 0; i < history.length; i++) {
        const entry = history[history.length - 1 - i];
        currentText = workspace.applyDiff(currentText, entry, false);
        if (entry.timestamp === timestamp) break;
    }

    return currentText;
}