import * as React from "react";
import * as auth from "./auth";
import * as core from "./core";
import * as data from "./data";
import * as sui from "./sui";
import * as simulator from "./simulator";
import * as screenshot from "./screenshot";
import * as qr from "./qr";
import { fireClickOnEnter } from "./util";

import { Modal, ModalAction } from "../../react-common/components/controls/Modal";
import { Share, ShareData } from "../../react-common/components/share/Share";
import { SimRecorderImpl } from "./components/SimRecorder";

type ISettingsProps = pxt.editor.ISettingsProps;

export enum ShareMode {
    Code,
    Url,
    Editor,
    Simulator
}

export interface ShareEditorProps extends ISettingsProps {
    loading?: boolean;
}

// This Component overrides shouldComponentUpdate, be sure to update that if the state is updated
export interface ShareEditorState {
    mode?: ShareMode;
    pubId?: string;
    visible?: boolean;
    sharingError?: Error;
    loading?: boolean;
    projectName?: string;
    projectNameChanged?: boolean;
    thumbnails?: boolean;
    screenshotUri?: string;
    recordError?: string;
    qrCodeUri?: string;
    qrCodeExpanded?: boolean;
    title?: string;
    kind?: "multiplayer" | "vscode" | "share";   // Was the share dialog opened specifically for hosting a multiplayer game?
}

export class ShareEditor extends auth.Component<ShareEditorProps, ShareEditorState> {
    protected autoThumbnailFrames: ImageData[];

    constructor(props: ShareEditorProps) {
        super(props);
        this.state = {
            pubId: undefined,
            visible: false,
            screenshotUri: undefined,
            recordError: undefined,
            title: undefined
        }

        this.hide = this.hide.bind(this);
        this.setAdvancedMode = this.setAdvancedMode.bind(this);
        this.handleProjectNameChange = this.handleProjectNameChange.bind(this);
        this.restartSimulator = this.restartSimulator.bind(this);
        this.handleCreateGitHubRepository = this.handleCreateGitHubRepository.bind(this);
    }

    hide() {
        if (this.state.qrCodeExpanded) {
            pxt.tickEvent('share.qrtoggle');
            const { qrCodeExpanded } = this.state;
            this.setState({ qrCodeExpanded: !qrCodeExpanded });
            return;
        }
        this.setState({
            visible: false,
            screenshotUri: undefined,
            projectName: undefined,
            projectNameChanged: false,
            recordError: undefined,
            qrCodeUri: undefined,
            title: undefined
        });
    }

    show(title?: string, kind: "multiplayer" | "vscode" | "share" = "share") {
        const { header } = this.props.parent.state;
        if (!header) return;
        // TODO investigate why edge does not render well
        // upon hiding dialog, the screen does not redraw properly
        const thumbnails = pxt.appTarget.cloud && pxt.appTarget.cloud.thumbnails
            && (pxt.appTarget.appTheme.simScreenshot || pxt.appTarget.appTheme.simGif);


        if (thumbnails) {
            this.renderInitialScreenshotAsync();
        }

        this.setState({
            thumbnails,
            visible: true,
            mode: ShareMode.Code,
            pubId: undefined,
            sharingError: undefined,
            screenshotUri: undefined,
            qrCodeUri: undefined,
            qrCodeExpanded: false,
            title,
            projectName: header.name,
            kind
        }, thumbnails ? (() => this.props.parent.startSimulator()) : undefined);
    }

    setThumbnailFrames(frames: ImageData[]) {
        this.autoThumbnailFrames = frames;
    }

    UNSAFE_componentWillReceiveProps(newProps: ShareEditorProps) {
        const newState: ShareEditorState = {}
        if (!this.state.projectNameChanged &&
            newProps.parent.state.projectName != this.state.projectName) {
            newState.projectName = newProps.parent.state.projectName;
        }
        if (newProps.loading != this.state.loading) {
            newState.loading = newProps.loading;
        }
        if (Object.keys(newState).length > 0) {
            this.setState(newState);
        }
    }

    shouldComponentUpdate(nextProps: ShareEditorProps, nextState: ShareEditorState, nextContext: any): boolean {
        return this.state.visible != nextState.visible
            || this.state.mode != nextState.mode
            || this.state.pubId != nextState.pubId
            || this.state.sharingError !== nextState.sharingError
            || this.state.projectName != nextState.projectName
            || this.state.projectNameChanged != nextState.projectNameChanged
            || this.state.loading != nextState.loading
            || this.state.screenshotUri != nextState.screenshotUri
            || this.state.qrCodeUri != nextState.qrCodeUri
            || this.state.qrCodeExpanded != nextState.qrCodeExpanded
            || this.state.title != nextState.title
            || this.state.kind != nextState.kind
            ;
    }

    private setAdvancedMode(mode: ShareMode) {
        this.setState({ mode: mode });
    }

    handleProjectNameChange(name: string) {
        this.setState({ projectName: name, projectNameChanged: true });
    }

    restartSimulator() {
        pxt.tickEvent('share.restart', undefined, { interactiveConsent: true });
        this.props.parent.restartSimulator();
    }

    handleCreateGitHubRepository() {
        pxt.tickEvent("share.github.create", undefined, { interactiveConsent: true });
        this.hide();
        this.props.parent.createGitHubRepositoryAsync();
    }

    protected async renderInitialScreenshotAsync() {
        let uri: string;

        if (this.autoThumbnailFrames) {
            const encoder = await screenshot.loadGifEncoderAsync();
            encoder.start();
            for (const frame of this.autoThumbnailFrames) {
                encoder.addFrame(frame);
            }
            uri = await encoder.renderAsync();
        }
        else {
            uri = await this.props.parent.requestScreenshotAsync();
        }

        if (!uri) {
            setTimeout(() => {
                this.renderInitialScreenshotAsync();
            }, 500)
        }
        else {
            this.setState({
                screenshotUri: uri
            });
        }

    }

    renderCore() {
        const { parent } = this.props;
        const { visible, projectName: newProjectName, title, screenshotUri } = this.state;
        const { simScreenshot, simGif } = pxt.appTarget.appTheme;
        const hasIdentity = auth.hasIdentity() && this.isLoggedIn();
        const thumbnails = simScreenshot || simGif;

        const hasProjectBeenPersistentShared = parent.hasHeaderBeenPersistentShared();

        const publishAsync = async (name: string, screenshotUri?: string, forceAnonymous?: boolean) =>
            parent.publishAsync(name, screenshotUri, forceAnonymous)

        const setSharePreference = (anonymousByDefault: boolean) => parent.saveSharePreferenceForHeaderAsync(anonymousByDefault)

        return visible
            ? <Modal
                title={lf("Share Project")}
                className={`sharedialog${thumbnails ? " wide" : ""}`}
                parentElement={document.getElementById("root") || undefined}
                onClose={this.hide}>
                <Share projectName={newProjectName}
                    screenshotUri={screenshotUri}
                    isLoggedIn={hasIdentity}
                    publishAsync={publishAsync}
                    hasProjectBeenPersistentShared={hasProjectBeenPersistentShared}
                    simRecorder={SimRecorderImpl}
                    anonymousShareByDefault={parent.getSharePreferenceForHeader()}
                    setAnonymousSharePreference={setSharePreference}
                    isMultiplayerGame={this.props.parent.state.isMultiplayerGame}
                    kind={this.state.kind}
                    onClose={this.hide}/>
            </Modal>
            : <></>
    }
}
