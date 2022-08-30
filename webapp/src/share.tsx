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
}

export class ShareEditor extends auth.Component<ShareEditorProps, ShareEditorState> {
    private _gifEncoder: screenshot.GifEncoder;

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
        if (this._gifEncoder) {
            this._gifEncoder.cancel();
            this._gifEncoder = undefined;
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

    show(title?: string) {
        const { header } = this.props.parent.state;
        if (!header) return;
        // TODO investigate why edge does not render well
        // upon hiding dialog, the screen does not redraw properly
        const thumbnails = pxt.appTarget.cloud && pxt.appTarget.cloud.thumbnails
            && (pxt.appTarget.appTheme.simScreenshot || pxt.appTarget.appTheme.simGif);
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
            projectName: header.name
        }, thumbnails ? (() => this.props.parent.startSimulator()) : undefined);
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

    screenshotAsync = () => {
        pxt.tickEvent("share.takescreenshot", { view: 'computer', collapsedTo: '' + !this.props.parent.state.collapseEditorTools }, { interactiveConsent: true });
        return this.props.parent.requestScreenshotAsync()
            .then(img => {
                if (img) {
                    this.setState({ screenshotUri: img });
                } else {
                    this.setState({ recordError: lf("Oops, screenshot failed. Please try again.") });
                }
            });
    }

    private loadEncoderAsync(): Promise<screenshot.GifEncoder> {
        if (this._gifEncoder) return Promise.resolve(this._gifEncoder);
        return screenshot.loadGifEncoderAsync()
            .then(encoder => this._gifEncoder = encoder);
    }

    gifRecord = async () => {
        pxt.tickEvent("share.gifrecord", { view: 'computer', collapsedTo: '' + !this.props.parent.state.collapseEditorTools }, { interactiveConsent: true });

        try {
            const encoder = await this.loadEncoderAsync();
            if (!encoder) {
                this.setState({
                    recordError: lf("Oops, gif encoder could not load. Please try again.")
                });
            } else {
                encoder.start();
                const gifwidth = pxt.appTarget.appTheme.simGifWidth || 160;
                simulator.driver.startRecording(gifwidth);
            }
        } catch (e: any) {
            pxt.reportException(e);
            this.setState({
                recordError: lf("Oops, gif recording failed. Please try again.")
            });
            if (this._gifEncoder) {
                this._gifEncoder.cancel();
            }
        }
    }

    gifRender = async (): Promise<string> => {
        pxt.debug(`render gif`)
        simulator.driver.stopRecording();
        if (!this._gifEncoder) return undefined;

        this.props.parent.stopSimulator();
        let uri = await this._gifEncoder.renderAsync();
        pxt.log(`gif: ${uri ? uri.length : 0} chars`)
        const maxSize = pxt.appTarget.appTheme.simScreenshotMaxUriLength;
        let recordError: string = undefined;
        if (uri) {
            if (maxSize && uri.length > maxSize) {
                pxt.tickEvent(`gif.toobig`, { size: uri.length });
                uri = undefined;
                recordError = lf("Gif is too big, try recording a shorter time.");
            } else
                pxt.tickEvent(`gif.ok`, { size: uri.length });
        }

        // give a breather to the browser to render the gif
        pxt.Util.delay(1000).then(() => this.props.parent.startSimulator());
        return uri;
    }

    gifAddFrame = (dataUri?: ImageData, delay?: number) => {
        if (this._gifEncoder) return this._gifEncoder.addFrame(dataUri, delay);
        return false;
    }

    handleCreateGitHubRepository() {
        pxt.tickEvent("share.github.create", undefined, { interactiveConsent: true });
        this.hide();
        this.props.parent.createGitHubRepositoryAsync();
    }

    protected async getShareUrl(pubId: string, persistent?: boolean) {
        const targetTheme = pxt.appTarget.appTheme;
        const header = this.props.parent.state.header;
        let shareData: ShareData = {
            url: "",
            embed: {}
        };

        let shareUrl = (persistent
            ? targetTheme.homeUrl
            : targetTheme.shareUrl) || "https://makecode.com/";
        if (!/\/$/.test(shareUrl)) shareUrl += '/';
        let rootUrl = targetTheme.embedUrl
        if (!/\/$/.test(rootUrl)) rootUrl += '/';
        const verPrefix = pxt.webConfig.verprefix || '';

        if (header) {
            shareData.url = `${shareUrl}${pubId}`;
            shareData.embed.code = pxt.docs.codeEmbedUrl(`${rootUrl}${verPrefix}`, pubId);
            shareData.embed.editor = pxt.docs.embedUrl(`${rootUrl}${verPrefix}`, "pub", pubId);
            shareData.embed.url = `${rootUrl}${verPrefix}#pub:${pubId}`;

            let padding = '81.97%';
            // TODO: parts aspect ratio
            let simulatorRunString = `${verPrefix}---run`;
            if (pxt.webConfig.runUrl) {
                if (pxt.webConfig.isStatic) {
                    simulatorRunString = pxt.webConfig.runUrl;
                }
                else {
                    // Always use live, not /beta etc.
                    simulatorRunString = pxt.webConfig.runUrl.replace(pxt.webConfig.relprefix, "/---")
                }
            }
            if (pxt.appTarget.simulator) padding = (100 / pxt.appTarget.simulator.aspectRatio).toPrecision(4) + '%';
            const runUrl = rootUrl + simulatorRunString.replace(/^\//, '');
            shareData.embed.simulator = pxt.docs.runUrl(runUrl, padding, pubId);
        }

        if (targetTheme.qrCode) {
            shareData.qr = await qr.renderAsync(`${shareUrl}${pubId}`);
        }

        return shareData;
    }

    renderCore() {
        const { parent } = this.props;
        const { visible, projectName: newProjectName, title, screenshotUri } = this.state;
        const { simScreenshot, simGif } = pxt.appTarget.appTheme;
        const hasIdentity = auth.hasIdentity() && this.isLoggedIn();
        const light = !!pxt.options.light;
        const thumbnails = pxt.appTarget.cloud && pxt.appTarget.cloud.thumbnails
            && (simScreenshot || simGif);

        const screenshotAsync = async () => await this.props.parent.requestScreenshotAsync();
        const publishAsync = async (name: string, screenshotUri?: string, forceAnonymous?: boolean) => {
            pxt.tickEvent("menu.embed.publish", undefined, { interactiveConsent: true });
            if (name && parent.state.projectName != name) {
                await parent.updateHeaderNameAsync(name);
            }
            try {
                const persistentPublish = hasIdentity && !forceAnonymous;
                const id = (persistentPublish
                    ? await parent.persistentPublishAsync(screenshotUri)
                    : await parent.anonymousPublishAsync(screenshotUri));
                return await this.getShareUrl(id, persistentPublish);
            } catch (e) {
                pxt.tickEvent("menu.embed.error", { code: (e as any).statusCode })
                return { url: "", embed: {}, error: e } as ShareData
            }
        }

        return visible
            ? <Modal
                title={lf("Share Project")}
                className="sharedialog wide"
                parentElement={document.getElementById("root") || undefined}
                onClose={this.hide}>
                <Share projectName={newProjectName}
                    screenshotUri={screenshotUri}
                    isLoggedIn={hasIdentity}
                    screenshotAsync={simScreenshot ? screenshotAsync : undefined}
                    gifRecordAsync={!light && simGif ? this.gifRecord : undefined}
                    gifRenderAsync={!light && simGif ? this.gifRender : undefined}
                    gifAddFrame={!light && simGif ? this.gifAddFrame : undefined}
                    publishAsync={publishAsync}
                    simRecorder={SimRecorderImpl}
                    registerSimulatorMsgHandler={thumbnails ? parent.pushScreenshotHandler : undefined}
                    unregisterSimulatorMsgHandler={thumbnails ? parent.popScreenshotHandler : undefined} />
            </Modal>
            : <></>
    }

    componentDidUpdate() {

    }
}
