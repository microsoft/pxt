import * as React from "react";
import * as workspace from "./workspace";
import { Tree, TreeItem, TreeItemBody } from "../../react-common/components/controls/Tree";
import { createPortal } from "react-dom";
import { Button } from "../../react-common/components/controls/Button";
import { hideDialog, warningNotification } from "./core";
import { FocusTrap } from "../../react-common/components/controls/FocusTrap";
import { classList } from "../../react-common/components/util";

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

interface TimelineEntry {
    label: string;
    entries: TimeEntry[];
}

interface TimeEntry {
    label: string;
    timestamp: number;
    kind: "snapshot" | "diff" | "share";
}

interface Project {
    files: pxt.workspace.ScriptText;
    editorVersion: string;
}

type FrameState = "loading" | "loaded" | "loading-project" | "loaded-project";

export const TimeMachine = (props: TimeMachineProps) => {
    const { text, history, onProjectLoad, onProjectCopy } = props;

    // undefined here is a standin for "now"
    const [selected, setSelected] = React.useState<TimeEntry>(undefined);
    const [loading, setLoading] = React.useState<FrameState>("loading");
    const [entries, setEntries] = React.useState(getTimelineEntries(history));

    const iframeRef = React.useRef<HTMLIFrameElement>();
    const fetchingScriptLock = React.useRef(false);

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

    React.useEffect(() => {
        setEntries(getTimelineEntries(history));
    }, [history]);

    const onTimeSelected = async (entry: TimeEntry) => {
        if (!importProject.current || fetchingScriptLock.current) return;

        if (entry.timestamp === -1) {
            entry = undefined;
        }

        setSelected(entry);

        if (entry === undefined) {
            importProject.current(text);
            return;
        }

        fetchingScriptLock.current = true;

        try {
            const { files } = await getTextAtTimestampAsync(text, history, entry);
            importProject.current(files)
        }
        catch (e) {
            if (entry.kind === "share") {
                warningNotification(lf("Unable to fetch shared project. Are you offline?"));
            }
            else {
                warningNotification(lf("Unable to restore project version. Try selecting a different version."))
            }

            setSelected(undefined);
            importProject.current(text);
        }
        finally {
            fetchingScriptLock.current = false;
        }
    };

    const onGoPressed = React.useCallback(async () => {
        if (selected === undefined) {
            hideDialog();
        }
        else {
            const { files, editorVersion } = await getTextAtTimestampAsync(text, history, selected);
            onProjectLoad(files, editorVersion, selected.timestamp);
        }
    }, [selected, onProjectLoad]);

    const onSaveCopySelect = React.useCallback(async () => {
        const { files, editorVersion } = await getTextAtTimestampAsync(text, history, selected);
        onProjectCopy(files, editorVersion, selected?.timestamp)
    }, [selected, onProjectCopy]);

    let queryParams = [
        "timeMachine",
        "controller",
        "skillsMap",
        "noproject",
        "nocookiebanner"
    ];

    if (pxt.appTarget?.appTheme.timeMachineQueryParams) {
        queryParams = queryParams.concat(pxt.appTarget.appTheme.timeMachineQueryParams);
    }

    const argString = queryParams.map(p => p.indexOf("=") === -1 ? `${p}=1` : p).join("&");

    const url = `${window.location.origin + window.location.pathname}?${argString}`;

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
                            {selected ? formatFullDate(selected.timestamp) : lf("Now")}
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
                            {entries.map((e, i) =>
                                <TreeItem key={i} initiallyExpanded={i === 0}>
                                    <TreeItemBody>
                                        {e.label}
                                    </TreeItemBody>
                                    <Tree role="group">
                                        {e.entries.map((entry, index) => {
                                            const isSelected = (!selected && entry.timestamp === -1) ||
                                                (selected?.kind === entry.kind && selected?.timestamp === entry.timestamp);

                                            let title: string;

                                            if (entry.kind === "share") {
                                                title = lf("Select shared version from {0} at {1}", e.label, entry.label);
                                            }
                                            else {
                                                title = lf("Select project version from {0} at {1}", e.label, entry.label);
                                            }

                                            return (
                                                <TreeItem
                                                    key={index}
                                                    onClick={() => onTimeSelected(entry)}
                                                    className={classList(isSelected && "selected", entry.kind)}
                                                    title={title}
                                                >
                                                    <TreeItemBody>
                                                        {entry.label}
                                                        {entry.kind === "share" && <i className="fas fa-share-alt" />}
                                                    </TreeItemBody>
                                                </TreeItem>
                                            );
                                        }
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

async function getTextAtTimestampAsync(text: pxt.workspace.ScriptText, history: pxt.workspace.HistoryFile, time: TimeEntry): Promise<Project> {
    const editorVersion = pxt.appTarget.versions.target;

    if (!time || time.timestamp < 0) return { files: text, editorVersion };

    if (time.kind === "snapshot") {
        const snapshot = history.snapshots.find(s => s.timestamp === time.timestamp)
        return patchPxtJson(pxt.workspace.applySnapshot(text, snapshot.text), snapshot.editorVersion);
    }
    else if (time.kind === "share") {
        const share = history.shares.find(s => s.timestamp === time.timestamp);
        const files = await pxt.Cloud.downloadScriptFilesAsync(share.id);
        const meta = await pxt.Cloud.downloadScriptMetaAsync(share.id);

        return {
            files,
            editorVersion: meta.versions?.target || editorVersion
        };
    }

    let currentText = text;

    for (let i = 0; i < history.entries.length; i++) {
        const index = history.entries.length - 1 - i;
        const entry = history.entries[index];
        currentText = workspace.applyDiff(currentText, entry);
        if (entry.timestamp === time.timestamp) {
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

function getTimelineEntries(history: pxt.workspace.HistoryFile): TimelineEntry[] {
    const buckets: {[index: string]: TimeEntry[]} = {};

    const createTimeEntry = (timestamp: number, kind: "snapshot" | "diff" | "share") => {
        const date = new Date(timestamp);
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
            label: formatTime(timestamp),
            timestamp,
            kind
        });
    }

    for (const entry of history.entries) {
        createTimeEntry(entry.timestamp, "diff");
    }

    for (const entry of history.snapshots) {
        createTimeEntry(entry.timestamp, "snapshot");
    }

    const sortedBuckets = Object.keys(buckets).sort((a, b) => parseInt(b) - parseInt(a));
    for (const bucketKey of sortedBuckets) {
        const bucket = buckets[bucketKey];
        const deduped: TimeEntry[] = [];

        // Deduplicate entries that exist in the same minute
        for (const entry of bucket) {
            const eIndex = deduped.findIndex(e => e.label === entry.label);
            const existing = deduped[eIndex];

            if (existing) {
                // We generally prefer snapshots to diffs. Otherwise take the latest
                if (existing.kind === entry.kind) {
                    if (entry.timestamp > existing.timestamp) {
                        deduped.splice(eIndex, 1, entry);
                    }
                }
                else if (existing.kind === "snapshot") {
                    continue;
                }
                else if (existing.kind === "diff") {
                    deduped.splice(eIndex, 1, entry);
                }
            }
            else {
                deduped.push(entry);
            }
        }

        buckets[bucketKey] = deduped;
    }

    // Always show all of the shares, don't dedupe these
    for (const entry of history.shares) {
        createTimeEntry(entry.timestamp, "share");
    }

    // Sort all of the buckets
    for (const bucketKey of sortedBuckets) {
        buckets[bucketKey].sort((a, b) => b.timestamp - a.timestamp);
    }

    // Always add an entry for "now"
    const nowEntry: TimeEntry = {
        label: lf("Now"),
        timestamp: -1,
        kind: "snapshot"
    };

    if (!sortedBuckets.length || !isToday(parseInt(sortedBuckets[0]))) {
        buckets[Date.now()] = [nowEntry]
    }
    else {
        buckets[sortedBuckets[0]].unshift(nowEntry)
    }

    return sortedBuckets.map(key => (
        {
            label: formatDate(parseInt(key)),
            entries: buckets[key]
        } as TimelineEntry
    ))
}