import * as React from "react";
import * as workspace from "./workspace";
import { Tree, TreeItem, TreeItemBody } from "../../react-common/components/controls/Tree";
import { createPortal } from "react-dom";
import { Button } from "../../react-common/components/controls/Button";
import { hideDialog } from "./core";
import { FocusTrap } from "../../react-common/components/controls/FocusTrap";

interface TimeMachineProps {
    onProjectLoad: (text: pxt.workspace.ScriptText, editorVersion: string, timestamp?: number) => void;
    onProjectCopy: (text: pxt.workspace.ScriptText, editorVersion: string, timestamp?: number) => void;
    text: pxt.workspace.ScriptText;
    history: pxt.workspace.HistoryFile;
}

interface PendingMessage {
    original: pxt.editor.EditorMessageRequest;
    handler: (response: any) => void;
}

interface TimeEntry {
    label: string;
    timestamp: number;
}

interface Project {
    files: pxt.workspace.ScriptText;
    editorVersion: string;
}

type FrameState = "loading" | "loaded" | "loading-project" | "loaded-project";

export const TimeMachine = (props: TimeMachineProps) => {
    const { text, history, onProjectLoad, onProjectCopy } = props;

    // -1 here is a standin for "now"
    const [selected, setSelected] = React.useState<number>(-1);
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
            importProject.current(text)
        }
    }, [loading, importProject.current, text]);

    const onTimeSelected = async (newValue: number) => {
        if (importProject.current) {
            setSelected(newValue);

            if (newValue === -1) {
                importProject.current(text);
            }
            else {
                const { files } = await getTextAtTimestampAsync(text, history, newValue);
                importProject.current(files)
            }
        }
    };

    const onGoPressed = React.useCallback(() => {
        (async () => {
            if (selected === -1) {
                hideDialog();
            }
            else {
                const { files, editorVersion } = await getTextAtTimestampAsync(text, history, selected);
                onProjectLoad(files, editorVersion, selected);
            }
        })();
    }, [selected, onProjectLoad]);

    const onSaveCopySelect = React.useCallback(() => {
        (async () => {
            const { files, editorVersion } = await getTextAtTimestampAsync(text, history, selected);
            onProjectCopy(files, editorVersion, selected)
        })();
    }, [selected, onProjectCopy]);

    const url = `${window.location.origin + window.location.pathname}?timeMachine=1&controller=1&skillsMap=1&noproject=1&nocookiebanner=1`;

    const buckets: {[index: string]: TimeEntry[]} = {};

    for (const entry of history.entries) {
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

        buckets[key].push({
            label: formatTime(entry.timestamp),
            timestamp: entry.timestamp
        });
    }

    const nowEntry = {
        label: lf("Now"),
        timestamp: -1
    };

    const sortedBuckets = Object.keys(buckets).sort((a, b) => parseInt(b) - parseInt(a));
    for (const bucket of sortedBuckets) {
        buckets[bucket].sort((a, b) => b.timestamp - a.timestamp);
    }

    if (!sortedBuckets.length || !isToday(parseInt(sortedBuckets[0]))) {
        buckets[Date.now()] = [nowEntry]
    }
    else {
        buckets[sortedBuckets[0]].unshift(nowEntry)
    }

    return createPortal(
        <FocusTrap className="time-machine" onEscape={hideDialog}>
            <div className="time-machine-header">
                <div className="time-machine-back-button">
                    <Button
                        className="menu-button"
                        label={lf("Go Back")}
                        title={lf("Go Back")}
                        onClick={hideDialog}
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
                            onClick={onSaveCopySelect}
                        />
                        <Button
                            label={lf("Restore")}
                            title={lf("Restore")}
                            onClick={onGoPressed}
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
                    <div className="time-machine-tree-container">
                        <Tree>
                            {sortedBuckets.map((date, i) =>
                                <TreeItem key={date} initiallyExpanded={i === 0}>
                                    <TreeItemBody>
                                        {formatDate(parseInt(date))}
                                    </TreeItemBody>
                                    <Tree role="group">
                                        {...buckets[date].map(entry =>
                                            <TreeItem
                                                key={entry.timestamp}
                                                onClick={() => onTimeSelected(entry.timestamp)}
                                                className={selected === entry.timestamp ?  "selected" : undefined}
                                            >
                                                <TreeItemBody>
                                                    {entry.label}
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
        </FocusTrap>
    , document.body);
}

async function getTextAtTimestampAsync(text: pxt.workspace.ScriptText, history: pxt.workspace.HistoryFile, timestamp: number): Promise<Project> {
    const editorVersion = pxt.appTarget.versions.target;

    if (timestamp < 0) return { files: text, editorVersion };

    const snapshot = history.snapshots.find(s => s.timestamp === timestamp)
    if (snapshot) {
        return patchPxtJson(pxt.workspace.applySnapshot(text, snapshot.text), snapshot.editorVersion);
    }

    const share = history.shares.find(s => s.timestamp === timestamp);
    if (share) {
        try {
            text = await pxt.Cloud.downloadScriptFilesAsync(share.id);
            return patchPxtJson(text, share.editorVersion)
        }
        catch (e) {
            if (!history.entries.some(e => e.timestamp === timestamp)) {
                // ERROR
            }
        }
    }

    let currentText = text;

    for (let i = 0; i < history.entries.length; i++) {
        const index = history.entries.length - 1 - i;
        const entry = history.entries[index];
        currentText = workspace.applyDiff(currentText, entry);
        if (entry.timestamp === timestamp) {
            const version = index > 0 ? history.entries[index - 1].editorVersion : entry.editorVersion;
            return patchPxtJson(currentText, version)
        }
    }

    return { files: currentText, editorVersion };
}

function patchPxtJson(text: pxt.workspace.ScriptText, editorVersion: string): Project {
    text = {...text};

    // Attempt to update the version in pxt.json
    try {
        const config = JSON.parse(text[pxt.CONFIG_NAME]) as pxt.PackageConfig;
        if (config.targetVersions) {
            config.targetVersions.target = editorVersion;
        }
        text[pxt.CONFIG_NAME] = JSON.stringify(config, null, 4);
    }
    catch (e) {
    }

    return {
        files: text,
        editorVersion
    };
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

function isToday(time: number) {
    const now = new Date();
    const date = new Date(time);
    return now.getFullYear() === date.getFullYear() &&
        now.getMonth() === date.getMonth() &&
        now.getDate() == date.getDate();
}