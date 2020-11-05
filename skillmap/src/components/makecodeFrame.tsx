/// <reference path="../../../built/pxteditor.d.ts" />
import * as React from "react";
import { connect } from 'react-redux';
import { getWorkspaceAsync } from "../lib/workspaceProvider";

import { SkillMapState } from '../store/reducer';
import  { dispatchSetHeaderIdForActivity } from '../actions/dispatch';

import '../styles/makecode-editor.css'

function isLocal() {
    return window.location.hostname === "localhost";
}

interface MakeCodeFrameProps {
    activityId: string;
    title: string;
    url: string;
    tutorialPath: string;
    activityHeaderId?: string;
    dispatchSetHeaderIdForActivity: (headerId: string) => void;
}

interface MakeCodeFrameState {
    loaded: boolean;
}

const editorUrl = isLocal() ? "http://localhost:3232/index.html" : "https://arcade.makecode.com"

class MakeCodeFrameImpl extends React.Component<MakeCodeFrameProps, MakeCodeFrameState> {
    protected ref: HTMLIFrameElement | undefined;
    protected messageQueue: any[] = [];

    constructor(props: MakeCodeFrameProps) {
        super(props);
        this.state = {
            loaded: false
        };
    }

    render() {
        const { url, title } = this.props;
        const { loaded } = this.state;

        const loadingText = "Loading..."
        const imageAlt = "MakeCode Logo";

        return <div className="makecode-frame-outer">
            <div className={`makecode-frame-loader ${loaded ? "hidden" : ""}`}>
                <img src="./logo.svg" alt={imageAlt} />
                <div className="makecode-frame-loader-text">{loadingText}</div>
            </div>
            <iframe className="makecode-frame" src={url} title={title} ref={this.handleFrameRef}></iframe>
        </div>
    }


    protected handleFrameRef = (ref: HTMLIFrameElement) => {
        if (ref && ref.contentWindow) {
            window.addEventListener("message", this.onMessageReceived);
            this.ref = ref;
        }
    }

    protected onMessageReceived = (event: MessageEvent) => {
        const data = event.data as pxt.editor.EditorMessageRequest;

        if ((data.type as string) === "ready") {
            this.handleWorkspaceReadyEventAsync();
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

    protected sendMessage(message: any) {
        if (this.ref) {
            if (!this.ref.contentWindow) {
                this.messageQueue.push(message);
            }
            else {
                while (this.messageQueue.length) {
                    this.ref.contentWindow.postMessage(this.messageQueue.shift(), "*");
                }
                this.ref.contentWindow.postMessage(message, "*");
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

        const workspace = await getWorkspaceAsync();
        const project = {
            ...request.project,
            header: {
                ...request.project.header!,
                id: activityHeaderId || request.project.header!.id
            }
        };

        await workspace.saveProjectAsync(project);


        if (!activityHeaderId) {
            dispatchSetHeaderIdForActivity(project.header!.id);
        }
    }

    protected async handleWorkspaceReadyEventAsync() {
        if (this.props.activityHeaderId) {
            const workspace = await getWorkspaceAsync();
            const project = await workspace.getProjectAsync(this.props.activityHeaderId);
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
        }
    }

    protected onEditorLoaded() {
        this.setState({
            loaded: true
        });
    }
}

function mapStateToProps(state: SkillMapState, ownProps: any) {
    if (!state || !state.editorView) return {};

    const { currentActivityId, currentMapId, currentHeaderId } = state.editorView;

    let url: string | undefined;
    let title: string | undefined;

    const activity = state.maps[currentMapId].activities[currentActivityId];
    url = `${editorUrl}/?controller=1&skillsMap=1`;
    title = activity.displayName;

    return {
        url,
        tutorialPath: activity.url,
        title,
        activityId: currentActivityId,
        activityHeaderId: currentHeaderId
    }
}

const mapDispatchToProps = {
    dispatchSetHeaderIdForActivity,
};

export const MakeCodeFrame = connect(mapStateToProps, mapDispatchToProps)(MakeCodeFrameImpl);