import * as React from "react";
import * as workspace from "./workspace";
import { Tree, TreeItem, TreeItemBody } from "../../react-common/components/controls/Tree";
import { createPortal } from "react-dom";
import { Button } from "../../react-common/components/controls/Button";

interface TimeMachineProps {
    onTimestampSelect: (timestamp: number) => void;
    text: pxt.workspace.ScriptText;
    history: pxt.workspace.HistoryEntry[];
}

interface PendingMessage {
    original: pxt.editor.EditorMessageRequest;
    handler: (response: any) => void;
}

type FrameState = "loading" | "loaded" | "loading-project" | "loaded-project";

export const TimeMachine = (props: TimeMachineProps) => {
    const { onTimestampSelect, text, history } = props;

    const [selected, setSelected] = React.useState<number>(history[history.length - 1]?.timestamp);
    const [loading, setLoading] = React.useState<FrameState>("loading")

    const iframeRef = React.useRef<HTMLIFrameElement>();

    const importProject = React.useRef<(text: pxt.workspace.ScriptText) => Promise<void>>();

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

        importProject.current = loadProject;

        window.addEventListener("message", onMessageReceived);
        return () => {
            window.removeEventListener("message", onMessageReceived);
        };
    }, []);

    React.useEffect(() => {
        if (loading === "loaded" && importProject.current) {
            const previewFiles = applyUntilTimestamp(text, history, history[history.length - 1].timestamp);
            importProject.current(previewFiles)
        }
    }, [loading, importProject.current, history, text]);

    const onTimeSelected = (newValue: number) => {
        if (importProject.current) {
            setSelected(newValue);
            const previewFiles = applyUntilTimestamp(text, history, newValue);
            importProject.current(previewFiles)
        }
    };

    const onGoPressed = React.useCallback(() => {
        onTimestampSelect(selected);
    }, [selected, onTimestampSelect, history]);

    const url = `${window.location.origin + window.location.pathname}?timeMachine=1&controller=1&skillsMap=1&noproject=1&nocookiebanner=1`;

    const buckets: {[index: string]: pxt.workspace.HistoryEntry[]} = {};

    for (const entry of history) {
        const date = new Date(entry.timestamp);
        const key = new Date(date.toLocaleDateString(
            pxt.U.userLanguage(),
            {
                year: "numeric",
                month: "numeric",
                day: "numeric"
            }
        )).getTime();

        if (!buckets[key]) {
            buckets[key] = [];
        }

        buckets[key].push(entry);
    }

    const sortedBuckets = Object.keys(buckets).sort((a, b) => parseInt(b) - parseInt(a));
    return createPortal(
        <div className="time-machine">
            <div className="time-machine-header">
                <div>
                    <Button
                        className="menu-button"
                        label={lf("Go Back")}
                        title={lf("Go Back")}
                        onClick={() => {}}
                        leftIcon="fas fa-arrow-left"
                    />
                </div>
                <div className="time-machine-actions-container">
                    <div className="time-machine-actions">
                        <div className="time-machine-label">
                            {formatFullDate(selected)}
                        </div>
                        <Button
                            label={lf("Save a copy")}
                            title={lf("Save a copy")}
                            onClick={() => {}}
                        />
                        <Button
                            label={lf("Restore")}
                            title={lf("Restore")}
                            onClick={() => {}}
                        />
                    </div>
                </div>
            </div>
            <div className="time-machine-content">
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
                <div className="time-machine-timeline">
                    <h3>
                        {lf("Version History")}
                    </h3>
                    <Tree>
                        {sortedBuckets.map((date, i) =>
                            <TreeItem key={date} initiallyExpanded={i === 0}>
                                <TreeItemBody>
                                    {formatDate(parseInt(date))}
                                </TreeItemBody>
                                <Tree role="group">
                                    {...buckets[date].sort((a, b) => b.timestamp - a.timestamp).map(entry =>
                                        <TreeItem
                                            key={entry.timestamp}
                                            onClick={() => onTimeSelected(entry.timestamp)}
                                            className={selected === entry.timestamp ?  "selected" : undefined}
                                        >
                                            <TreeItemBody>
                                                {formatTime(entry.timestamp)}
                                            </TreeItemBody>
                                        </TreeItem>
                                    )}
                                </Tree>
                            </TreeItem>
                        )}
                    </Tree>
                </div>
            </div>
        </div>
    , document.body);
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
    const date = new Date(time);

    const timeString = date.toLocaleTimeString(pxt.U.userLanguage(), { timeStyle: "short" } as any);
    return timeString;
}

function formatDate(time: number) {
    const now = new Date();
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth();
    const nowDay = now.getDate();

    const date = new Date(time);
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();

    const diff = Date.now() - time;
    const oneDay = 1000 * 60 * 60 * 24;

    if (year !== nowYear) {
        return date.toLocaleDateString(
            pxt.U.userLanguage(),
            {
                year: "numeric",
                month: "short",
                day: "numeric"
            }
        );
    }
    else if (nowMonth === month && nowDay === day) {
        return lf("Today");
    }
    else if (diff < oneDay * 2) {
        return lf("Yesterday")
    }
    else if (diff < oneDay * 8) {
        return lf("{0} days ago", Math.floor(diff / oneDay))
    }
    else {
        return date.toLocaleDateString(
            pxt.U.userLanguage(),
            {
                month: "short",
                day: "numeric"
            }
        );
    }
}

function formatFullDate(time: number) {
    const now = new Date();
    const nowYear = now.getFullYear();

    const date = new Date(time);
    const year = date.getFullYear();

    const formattedDate = date.toLocaleDateString(
        pxt.U.userLanguage(),
        {
            year: year !== nowYear ? "numeric" : undefined,
            month: "long",
            day: "numeric"
        } as any
    );

    const formattedTime = formatTime(time);

    return lf("{id:date,time}{0}, {1}", formattedDate, formattedTime);
}