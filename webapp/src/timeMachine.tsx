import * as React from "react";
import * as workspace from "./workspace";
import { Button } from "../../react-common/components/controls/Button";
import { VerticalSlider } from "../../react-common/components/controls/VerticalSlider";

interface TimeMachineProps {
    onTimestampSelect: (timestamp: number) => void;
    text: pxt.workspace.ScriptText;
    history: pxt.workspace.HistoryEntry[];
}

interface FunctionWrapper<U> {
    impl: U;
}

interface PendingMessage {
    original: pxt.editor.EditorMessageRequest;
    handler: (response: any) => void;
}

type FrameState = "loading" | "loaded" | "loading-project" | "loaded-project";

export const TimeMachine = (props: TimeMachineProps) => {
    const { onTimestampSelect, text, history } = props;

    const [selected, setSelected] = React.useState<number>(history.length - 1);
    const [importProject, setImportProject] = React.useState<FunctionWrapper<(text: pxt.workspace.ScriptText) => Promise<void>>>();

    const [loading, setLoading] = React.useState<FrameState>("loading")

    const iframeRef = React.useRef<HTMLIFrameElement>();

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
                    if (!workspaceReady) {
                        workspaceReady = true;
                        setLoading("loaded")
                        sendMessageAsync();
                    }
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

        let pendingLoad: pxt.workspace.ScriptText;
        let currentlyLoading = false;

        const loadProject = async (project: pxt.workspace.ScriptText) => {
            if (currentlyLoading) {
                pendingLoad = project;
                return;
            }

            currentlyLoading = true;
            setLoading("loading-project");
            await sendMessageAsync({
                type: "pxteditor",
                action: "importproject",
                project: {
                    text: project
                }
            } as pxt.editor.EditorMessageImportProjectRequest);

            currentlyLoading = false;

            if (pendingLoad) {
                loadProject(pendingLoad);
                pendingLoad = undefined;
                return;
            }

            setLoading("loaded-project");

        };

        setImportProject({ impl: loadProject });

        window.addEventListener("message", onMessageReceived);
        return () => {
            window.removeEventListener("message", onMessageReceived);
        };
    }, []);

    React.useEffect(() => {
        if (loading === "loaded" && importProject) {
            const previewFiles = applyUntilTimestamp(text, history, history[history.length - 1].timestamp);
            importProject.impl(previewFiles)
        }
    }, [loading, importProject, history, text]);

    const onSliderValueChanged = React.useCallback((newValue: number) => {
        setSelected(newValue);
        const previewFiles = applyUntilTimestamp(text, history, history[newValue].timestamp);
        importProject.impl(previewFiles)

    }, [text, history, importProject]);

    const valueText = React.useCallback((value: number) => {
        const timestamp = history[value].timestamp;

        return formatTime(timestamp);
    }, [history]);

    const onGoPressed = React.useCallback(() => {
        onTimestampSelect(history[selected].timestamp);
    }, [selected, onTimestampSelect, history]);

    const url = `${window.location.origin + window.location.pathname}?timeMachine=1&controller=1&skillsMap=1&noproject=1&nocookiebanner=1`;

    return (
        <div className="time-machine">
            <div className="time-machine-timeline">
                <div className="time-machine-label">
                    {pxt.U.lf("Past")}
                </div>
                <VerticalSlider
                    className="time-machine-timeline-slider"
                    min={0}
                    max={history.length - 1}
                    step={1}
                    value={selected}
                    ariaValueText={valueText}
                    onValueChanged={onSliderValueChanged}
                />
                <div className="time-machine-label">
                    {pxt.U.lf("Present")}
                </div>
                <Button
                    className="green"
                    label={pxt.U.lf("Go")}
                    title={pxt.U.lf("Restore editor to selected version")}
                    onClick={onGoPressed}
                />
            </div>
            <div className="time-machine-preview">
                <div>
                    <div className="common-spinner" />
                </div>
                {/* eslint-disable @microsoft/sdl/react-iframe-missing-sandbox */}
                <iframe
                    style={{ opacity: loading !== "loaded-project" ? 0 : 1 }}
                    ref={iframeRef}
                    frameBorder="0"
                    aria-label={lf("Project preview")}
                    sandbox="allow-popups allow-forms allow-scripts allow-same-origin allow-modals"
                    src={url}
                />
                {/* eslint-enable @microsoft/sdl/react-iframe-missing-sandbox */}
            </div>
        </div>
    );
}

function applyUntilTimestamp(text: pxt.workspace.ScriptText, history: pxt.workspace.HistoryEntry[], timestamp: number) {
    let currentText = { ...text };

    for (let i = 0; i < history.length; i++) {
        const entry = history[history.length - 1 - i];
        currentText = workspace.applyDiff(currentText, entry);
        if (entry.timestamp === timestamp) break;
    }

    return currentText;
}

function formatTime(time: number) {
    const now = Date.now();

    const diff = now - time;
    const oneDay = 1000 * 60 * 60 * 24;

    const date = new Date(time);

    const timeString = date.toLocaleTimeString(pxt.U.userLanguage(), { timeStyle: "short" } as any);

    if (diff < oneDay) {
        return timeString;
    }
    else if (diff < oneDay * 2) {
        return lf("Yesterday {0}", timeString);
    }
    else {
        return date.toLocaleDateString() + " " + timeString;
    }
}