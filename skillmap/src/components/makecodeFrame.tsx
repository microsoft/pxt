/// <reference path="../../../built/pxteditor.d.ts" />
import * as React from "react";
import { connect } from 'react-redux';
import { saveProjectAsync, getProjectAsync } from "../lib/workspaceProvider";
import { isLocal, resolvePath, tickEvent } from "../lib/browserUtils";
import { lookupActivityProgress } from "../lib/skillMapUtils";

import { SkillMapState } from '../store/reducer';
import  { dispatchSetHeaderIdForActivity, dispatchCloseActivity, dispatchSaveAndCloseActivity, dispatchUpdateUserCompletedTags } from '../actions/dispatch';

import '../styles/makecode-editor.css'

interface MakeCodeFrameProps {
    save: boolean;
    activityId: string;
    title: string;
    url: string;
    tutorialPath: string;
    completed: boolean;
    activityHeaderId?: string;
    dispatchSetHeaderIdForActivity: (headerId: string, currentStep: number, maxSteps: number) => void;
    dispatchCloseActivity: (finished?: boolean) => void;
    dispatchSaveAndCloseActivity: () => void;
    dispatchUpdateUserCompletedTags: () => void;
}

interface MakeCodeFrameState {
    loaded: boolean;

    // See handleFrameRef
    unloading: boolean;
}

const editorUrl: string = isLocal() ? "http://localhost:3232/index.html" : (window as any).pxtTargetBundle.appTheme.embedUrl

class MakeCodeFrameImpl extends React.Component<MakeCodeFrameProps, MakeCodeFrameState> {
    protected ref: HTMLIFrameElement | undefined;
    protected messageQueue: any[] = [];
    protected finishedTutorial = false;
    protected nextId: number = 0;
    protected pendingMessages: {[index: string]: any} = {};

    constructor(props: MakeCodeFrameProps) {
        super(props);
        this.state = {
            loaded: false,
            unloading: false
        };
    }

    componentDidUpdate() {
        if (this.props.save) {
            this.sendMessage({
                type: "pxteditor",
                action: "saveproject",
                response: false
            } as pxt.editor.EditorMessage, true);
        }
    }

    componentWillUnmount() {
        window.removeEventListener("message", this.onMessageReceived);
    }

    render() {
        const { url, title, save } = this.props;
        const { loaded, unloading } = this.state;

        const loadingText = save ? "Saving..." : "Loading..."
        const imageAlt = "MakeCode Logo";

        return <div className="makecode-frame-outer">
            <div className={`makecode-frame-loader ${(loaded && !save) ? "hidden" : ""}`}>
                <img src={resolvePath("assets/logo.svg")} alt={imageAlt} />
                <div className="makecode-frame-loader-text">{loadingText}</div>
            </div>
            <iframe className="makecode-frame" src={unloading ? "about:blank" : url} title={title} ref={this.handleFrameRef}></iframe>
        </div>
    }


    protected handleFrameRef = (ref: HTMLIFrameElement) => {
        if (ref && ref.contentWindow) {
            window.addEventListener("message", this.onMessageReceived);
            this.ref = ref;

            this.ref.addEventListener("load", () => {
                // This is a workaround for a bug in Chrome where for some reason the page hangs when
                // trying to unload the makecode iframe. Instead, we set the src to about:blank, wait for
                // that to load, and then unload the iframe
                if (this.state.unloading) {
                    this.props.dispatchCloseActivity();
                    this.props.dispatchUpdateUserCompletedTags();
                }
            });
        }
    }

    protected onMessageReceived = (event: MessageEvent) => {
        const data = event.data as pxt.editor.EditorMessageRequest;

        if ((data.type as string) === "ready") {
            this.handleWorkspaceReadyEventAsync();
            return;
        }

        if (data.type === "pxteditor" && data.id && this.pendingMessages[data.id]) {
            this.onResponseReceived(this.pendingMessages[data.id], event.data as pxt.editor.EditorMessageResponse);
            delete this.pendingMessages[data.id];
            return;
        }

        switch (data.action) {
            case "event":
                this.handleEditorTickEvent(data as pxt.editor.EditorMessageEventRequest);
                break;
            case "workspacesync":
                this.handleWorkspaceSyncRequest(data as pxt.editor.EditorWorkspaceSyncRequest);
                break;
            case "workspacesave":
                this.handleWorkspaceSaveRequestAsync(data as pxt.editor.EditorWorkspaceSaveRequest);
                break;
            default:
                console.log(JSON.stringify(data, null, 4));
        }
    }

    protected onResponseReceived(original: any, response: pxt.editor.EditorMessageResponse) {
        const { save } = this.props;

        if (original.action === "saveproject" && save) {
            if (this.finishedTutorial) {
                this.finishedTutorial = false;

                // Save again to be sure we get any final edits
                this.sendMessage({
                    type: "pxteditor",
                    action: "saveproject"
                } as pxt.editor.EditorMessage, true);
            }
            else {
                this.setState({
                    unloading: true
                });
            }
        }
    }

    protected sendMessage(message: any, response = false) {
        const sendMessageCore = (message: any) => {
            if (response) {
                message.response = true;
                message.id = this.nextId++ + "";
                this.pendingMessages[message.id] = message;
            }
            this.ref!.contentWindow!.postMessage(message, "*");
        }

        if (this.ref) {
            if (!this.ref.contentWindow) {
                this.messageQueue.push(message);
            }
            else {
                while (this.messageQueue.length) {
                    sendMessageCore(this.messageQueue.shift());
                }
                sendMessageCore(message);
            }
        }
    }

    protected handleWorkspaceSyncRequest(request: pxt.editor.EditorWorkspaceSyncRequest) {
        this.sendMessage({
            ...request,
            success: true,
            projects: []
        } as pxt.editor.EditorWorkspaceSyncResponse);
    }

    protected async handleWorkspaceSaveRequestAsync(request: pxt.editor.EditorWorkspaceSaveRequest) {
        const { dispatchSetHeaderIdForActivity, activityHeaderId } = this.props;

        const project = {
            ...request.project,
            header: {
                ...request.project.header!,
                id: activityHeaderId || request.project.header!.id
            }
        };

        await saveProjectAsync(project);

        if (project.header!.tutorial) {
            dispatchSetHeaderIdForActivity(
                project.header.id,
                (project.header.tutorial.tutorialStep || 0) + 1,
                project.header.tutorial.tutorialStepInfo!.length
            );
        }
        else if (project.header!.tutorialCompleted) {
            dispatchSetHeaderIdForActivity(
                project.header.id,
                project.header.tutorialCompleted.steps,
                project.header.tutorialCompleted.steps
            );
        }
    }

    protected async handleWorkspaceReadyEventAsync() {
        if (this.props.activityHeaderId) {
            const project = await getProjectAsync(this.props.activityHeaderId);
            this.sendMessage({
                type: "pxteditor",
                action: "importproject",
                project: project
            } as pxt.editor.EditorMessageImportProjectRequest)
        }
        else {
            this.sendMessage({
                type: "pxteditor",
                action: "startactivity",
                path: this.props.tutorialPath,
                activityType: "tutorial"
            } as pxt.editor.EditorMessageStartActivity);
        }
    }

    protected handleEditorTickEvent(event: pxt.editor.EditorMessageEventRequest) {
        switch (event.tick) {
            // FIXME: add a better tick; app.editor fires too early
            case "app.editor":
                this.onEditorLoaded();
                break;
            case "tutorial.complete":
                this.onTutorialFinished();
                break;

        }
    }

    protected onEditorLoaded() {
        tickEvent("skillmap.activity.loaded");
        this.setState({
            loaded: true
        });
    }

    protected onTutorialFinished() {
        tickEvent("skillmap.activity.complete");
        this.finishedTutorial = true;
        this.props.dispatchSaveAndCloseActivity();
    }
}

function mapStateToProps(state: SkillMapState, ownProps: any) {
    if (!state || !state.editorView) return {};

    const { currentActivityId, currentMapId, currentHeaderId, state: saveState } = state.editorView;

    let url = editorUrl
    let title: string | undefined;

    const activity = state.maps[currentMapId].activities[currentActivityId];
    if (editorUrl.charAt(editorUrl.length - 1) === "/" && !isLocal()) {
        url = editorUrl.substr(0, editorUrl.length - 1);
    }

    url += `?controller=1&skillsMap=1`;
    title = activity.displayName;

    return {
        url,
        tutorialPath: activity.url,
        title,
        activityId: currentActivityId,
        activityHeaderId: currentHeaderId,
        completed: lookupActivityProgress(state.user, currentMapId, currentActivityId)?.isCompleted,
        save: saveState === "saving"
    }
}

const mapDispatchToProps = {
    dispatchSetHeaderIdForActivity,
    dispatchCloseActivity,
    dispatchSaveAndCloseActivity,
    dispatchUpdateUserCompletedTags
};

export const MakeCodeFrame = connect(mapStateToProps, mapDispatchToProps)(MakeCodeFrameImpl);