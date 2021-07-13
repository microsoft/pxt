/// <reference path="../../../built/pxteditor.d.ts" />
import * as React from "react";
import { connect } from 'react-redux';
import { saveProjectAsync, getProjectAsync } from "../lib/workspaceProvider";
import { isLocal, resolvePath, getEditorUrl, tickEvent } from "../lib/browserUtils";
import { isActivityCompleted, lookupActivityProgress, lookupPreviousActivityStates } from "../lib/skillMapUtils";

import { SkillMapState } from '../store/reducer';
import  { dispatchSetHeaderIdForActivity, dispatchCloseActivity, dispatchSaveAndCloseActivity, dispatchUpdateUserCompletedTags, dispatchSetReloadHeaderState } from '../actions/dispatch';

/* eslint-disable import/no-unassigned-import, import/no-internal-modules */
import '../styles/makecode-editor.css'
/* eslint-enable import/no-unassigned-import, import/no-internal-modules */

interface MakeCodeFrameProps {
    save: boolean;
    reload: "reloading" | "reload" | undefined;
    mapId: string;
    activityId: string;
    title: string;
    url: string;
    tutorialPath: string;
    activityHeaderId?: string;
    activityType: MapActivityType;
    carryoverCode: boolean;
    previousHeaderId?: string;
    progress?: ActivityState;
    dispatchSetHeaderIdForActivity: (mapId: string, activityId: string, id: string, currentStep: number, maxSteps: number, isCompleted: boolean) => void;
    dispatchCloseActivity: (finished?: boolean) => void;
    dispatchSaveAndCloseActivity: () => void;
    dispatchUpdateUserCompletedTags: () => void;
    dispatchSetReloadHeaderState: (state: "reload" | "reloading" | "active") => void;
}

interface MakeCodeFrameState {
    loaded: boolean;
    unloading: "unloading" | "unloaded" | null; // See handleFrameRef
    loadPercent?: number; // Progress bar load % from 0 - 100 (loaded)
}

interface PendingMessage {
    original: pxt.editor.EditorMessageRequest;
    handler: (original: any) => void;
}

export const editorUrl: string = isLocal() ? "http://localhost:3232/index.html" : getEditorUrl((window as any).pxtTargetBundle.appTheme.embedUrl)

class MakeCodeFrameImpl extends React.Component<MakeCodeFrameProps, MakeCodeFrameState> {
    protected ref: HTMLIFrameElement | undefined;
    protected messageQueue: pxt.editor.EditorMessageRequest[] = [];
    protected finishedActivityState: "saving" | "finished" | undefined;
    protected nextId: number = 0;
    protected pendingMessages: {[index: string]: PendingMessage} = {};
    protected isNewActivity: boolean = false;
    protected sentReloadImportRequest: boolean = false;

    constructor(props: MakeCodeFrameProps) {
        super(props);
        this.state = {
            loaded: false,
            unloading: null,
            loadPercent: 0
        };
    }

    async componentDidUpdate() {
        if (this.props.save && !this.state.unloading) {
            await this.sendMessageAsync({
                type: "pxteditor",
                action: "saveproject"
            } as pxt.editor.EditorMessageRequest);

            this.setState({
                unloading: "unloading"
            });
        }

        if (this.props.reload === "reload" && !this.sentReloadImportRequest) {
            this.sentReloadImportRequest = true;

            await this.sendMessageAsync({
                type: "pxteditor",
                action: "openheader",
                headerId: this.props.activityHeaderId
            } as pxt.editor.EditorMessageOpenHeaderRequest);
        }
    }

    componentWillUnmount() {
        window.removeEventListener("message", this.onMessageReceived);

        // Show Usabilla widget + footer
        setElementVisible(".usabilla_live_button_container", true);
        setElementVisible("footer", true);

        const root = document.getElementById("root");
        if (root) pxt.BrowserUtils.removeClass(root, "editor");
    }

    render() {
        const { url, title } = this.props;
        const { loaded, unloading, loadPercent } = this.state;

        const loadingText =  lf("Loading...")
        const imageAlt = "MakeCode Logo";

        /* eslint-disable @microsoft/sdl/react-iframe-missing-sandbox */
        return <div className="makecode-frame-outer">
            <div className={`makecode-frame-loader ${loaded ? "hidden" : ""}`}>
                <img src={resolvePath("assets/logo.svg")} alt={imageAlt} />
                {!loaded && <div className="makecode-frame-loader-bar">
                    <div className="makecode-frame-loader-fill" style={{ width: loadPercent + "%" }} />
                </div>}
                <div className="makecode-frame-loader-text">{loadingText}</div>
            </div>
            <iframe className="makecode-frame" src={unloading ? "about:blank" : url} title={title} ref={this.handleFrameRef}></iframe>
        </div>
        /* eslint-enable @microsoft/sdl/react-iframe-missing-sandbox */
    }


    protected handleFrameRef = (ref: HTMLIFrameElement) => {
        if (ref && ref.contentWindow) {
            window.addEventListener("message", this.onMessageReceived);
            this.ref = ref;

            this.ref.addEventListener("load", () => {
                // This is a workaround for a bug in Chrome where for some reason the page hangs when
                // trying to unload the makecode iframe. Instead, we set the src to about:blank, wait for
                // that to load, and then unload the iframe
                if (this.state.unloading === "unloading") {
                    this.props.dispatchCloseActivity(this.finishedActivityState === "finished");
                    this.props.dispatchUpdateUserCompletedTags();

                    this.finishedActivityState = undefined;
                    this.setState({ unloading: "unloaded" });
                }
            });

            // Hide Usabilla widget + footer when inside iframe view
            setElementVisible(".usabilla_live_button_container", false);
            setElementVisible("footer", false);

            const root = document.getElementById("root");
            if (root) pxt.BrowserUtils.addClass(root, "editor");
        }
    }

    protected onMessageReceived = (event: MessageEvent) => {
        const data = event.data as pxt.editor.EditorMessageRequest;
        if (!this.state.loaded) this.setState({ loadPercent: Math.min((this.state.loadPercent || 0) + 4, 95) });

        if (data.type === "pxteditor" && data.id && this.pendingMessages[data.id]) {
            const pending = this.pendingMessages[data.id];
            pending.handler(pending.original);
            delete this.pendingMessages[data.id];
            return;
        }

        switch (data.action) {
            case "event":
                this.handleEditorTickEvent(data as pxt.editor.EditorMessageEventRequest);
                break;
            case "workspaceevent":
                if ((data as pxt.editor.EditorWorkspaceEvent).event.type === "createproject") {
                    this.handleWorkspaceReadyEventAsync();
                }
                break;
            case "tutorialevent":
                this.handleTutorialProgressEvent(data as pxt.editor.EditorMessageTutorialEventRequest);
                break;
            default:
                // console.log(JSON.stringify(data, null, 4));
        }
    }

    protected sendMessageAsync(message: any) {
        return new Promise(resolve => {
            const sendMessageCore = (message: any) => {
                message.response = true;
                message.id = this.nextId++ + "";
                this.pendingMessages[message.id] = {
                    original: message,
                    handler: resolve
                };
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
        });
    }

    protected async handleWorkspaceReadyEventAsync() {
        if (this.props.activityHeaderId) {
            await this.sendMessageAsync({
                type: "pxteditor",
                action: "openheader",
                headerId: this.props.activityHeaderId
            });
        }
        else {
            this.isNewActivity = true;
            await this.sendMessageAsync({
                type: "pxteditor",
                action: "startactivity",
                path: this.props.tutorialPath,
                activityType: "tutorial",
                carryoverPreviousCode: this.props.carryoverCode,
                previousProjectHeaderId: this.props.previousHeaderId
            } as pxt.editor.EditorMessageStartActivity);
        }
    }

    protected handleEditorTickEvent(event: pxt.editor.EditorMessageEventRequest) {
        switch (event.tick) {
            case "editor.loaded":
                this.handleWorkspaceReadyEventAsync();
                break;
            case "tutorial.editorLoaded":
                this.onEditorLoaded();
                break;
            case "tutorial.complete":
                this.onTutorialFinished();
                break;
        }
    }

    protected handleTutorialProgressEvent(event: pxt.editor.EditorMessageTutorialEventRequest) {
        const { dispatchSetHeaderIdForActivity, mapId, activityId, progress } = this.props;

        dispatchSetHeaderIdForActivity(
            mapId,
            activityId,
            event.projectHeaderId,
            event.currentStep + 1,
            event.totalSteps,
            event.isCompleted || !!progress?.isCompleted
        );
    }

    protected onEditorLoaded() {
        const { mapId, activityId } = this.props;
        tickEvent("skillmap.activity.loaded", { path: mapId, activity: activityId });
        this.setState({
            loaded: true
        });

        if (this.isNewActivity) {
            this.isNewActivity = false;
        }
    }

    protected onTutorialFinished() {
        const { mapId, activityId, progress, dispatchSetHeaderIdForActivity } = this.props;
        tickEvent("skillmap.activity.complete", { path: mapId, activity: activityId });
        this.finishedActivityState = "saving";

        if (progress) {
            dispatchSetHeaderIdForActivity(
                mapId,
                activityId,
                progress.headerId!,
                progress.currentStep!,
                progress.maxSteps!,
                true
            );
        }

        this.props.dispatchSaveAndCloseActivity();
    }
}

function mapStateToProps(state: SkillMapState, ownProps: any) {
    if (!state || !state.editorView) return {};

    const { currentActivityId, currentMapId, currentHeaderId, state: saveState, allowCodeCarryover, previousHeaderId } = state.editorView;

    let url = editorUrl
    let title: string | undefined;
    const map = state.maps[currentMapId];

    const activity = map.activities[currentActivityId] as MapActivity;
    if (editorUrl.charAt(editorUrl.length - 1) === "/" && !isLocal()) {
        url = editorUrl.substr(0, editorUrl.length - 1);
    }

    url += `?controller=1&skillsMap=1&noproject=1&nocookiebanner=1&ws=browser`;
    title = activity.displayName;

    const progress = lookupActivityProgress(state.user, state.pageSourceUrl, currentMapId, currentActivityId);

    return {
        url,
        tutorialPath: activity.url,
        title,
        mapId: currentMapId,
        activityId: currentActivityId,
        activityHeaderId: currentHeaderId,
        activityType: activity.type,
        carryoverCode: allowCodeCarryover,
        previousHeaderId: previousHeaderId,
        progress,
        save: saveState === "saving",
        reload: saveState === "reload" || saveState === "reloading" ? saveState : undefined
    }
}

function setElementVisible(selector: string, visible: boolean) {
    const el = document.querySelector(selector) as HTMLDivElement;
    if (el?.style) el.style.display = visible ? "" : "none";
}

const mapDispatchToProps = {
    dispatchSetHeaderIdForActivity,
    dispatchCloseActivity,
    dispatchSaveAndCloseActivity,
    dispatchUpdateUserCompletedTags,
    dispatchSetReloadHeaderState
};

export const MakeCodeFrame = connect(mapStateToProps, mapDispatchToProps)(MakeCodeFrameImpl);