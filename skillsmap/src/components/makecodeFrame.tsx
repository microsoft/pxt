/// <reference path="../../../built/pxteditor.d.ts" />
import * as React from "react";
import { connect } from 'react-redux';
import { getWorkspaceAsync } from "../lib/workspaceProvider";

import { SkillsMapState } from '../store/reducer';
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

const editorUrl = isLocal() ? "http://localhost:3232/index.html" : "https://arcade.makecode.com"

class MakeCodeFrameImpl extends React.Component<MakeCodeFrameProps> {
    protected ref: HTMLIFrameElement | undefined;
    protected messageQueue: any[] = [];

    render() {
        const { url, title } = this.props;

        return <iframe className="makecode-frame" src={url} title={title} ref={this.handleFrameRef}></iframe>
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
}

function mapStateToProps(state: SkillsMapState, ownProps: any) {
    if (!state || !state.editorView) return {};

    const { currentActivityId, currentMapId, currentHeaderId } = state.editorView;

    let url: string | undefined;
    let title: string | undefined;

    const activity = state.maps[currentMapId].activities[currentActivityId];
    url = `${editorUrl}/?controller=1`;
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