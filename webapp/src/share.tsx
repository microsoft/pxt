import * as React from "react";
import * as core from "./core";
import * as data from "./data";
import * as sui from "./sui";
import * as simulator from "./simulator";
import * as screenshot from "./screenshot";
import * as qr from "./qr";
import { fireClickOnEnter } from "./util";

import { Modal, ModalAction } from "../../react-common/components/controls/Modal";
import { Share, ShareData } from "../../react-common/components/share/Share";

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

export enum ShareRecordingState {
    None,
    ScreenshotSnap,
    GifLoading,
    GifRecording,
    GifRendering
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
    recordingState?: ShareRecordingState;
    recordError?: string;
    qrCodeUri?: string;
    qrCodeExpanded?: boolean;
    title?: string;
}

export class ShareEditor extends data.Component<ShareEditorProps, ShareEditorState> {
    private loanedSimulator: HTMLElement;
    private _gifEncoder: screenshot.GifEncoder;

    constructor(props: ShareEditorProps) {
        super(props);
        this.state = {
            pubId: undefined,
            visible: false,
            screenshotUri: undefined,
            recordingState: ShareRecordingState.None,
            recordError: undefined,
            title: undefined
        }

        this.hide = this.hide.bind(this);
        this.setAdvancedMode = this.setAdvancedMode.bind(this);
        this.handleProjectNameChange = this.handleProjectNameChange.bind(this);
        this.restartSimulator = this.restartSimulator.bind(this);
        this.handleRecordClick = this.handleRecordClick.bind(this);
        this.handleScreenshotClick = this.handleScreenshotClick.bind(this);
        this.handleScreenshotMessage = this.handleScreenshotMessage.bind(this);
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
        if (this.loanedSimulator) {
            simulator.driver.unloanSimulator();
            this.loanedSimulator = undefined;
            this.props.parent.popScreenshotHandler();
            simulator.driver.stopRecording();
        }
        this.setState({
            visible: false,
            screenshotUri: undefined,
            projectName: undefined,
            projectNameChanged: false,
            recordingState: ShareRecordingState.None,
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
        if (thumbnails) {
            this.loanedSimulator = simulator.driver.loanSimulator();
            this.props.parent.pushScreenshotHandler(this.handleScreenshotMessage);
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
            projectName: header.name
        }, thumbnails ? (() => this.props.parent.startSimulator()) : undefined);
    }

    handleScreenshotMessage(msg: pxt.editor.ScreenshotData) {
        const { visible } = this.state;

        if (!msg || !visible) return;

        if (msg.event === "start") {
            switch (this.state.recordingState) {
                case ShareRecordingState.None:
                    this.gifRecord();
                    break;
                default:
                    // ignore
                    break;
            }
            return;
        } else if (msg.event == "stop") {
            switch (this.state.recordingState) {
                case ShareRecordingState.GifRecording:
                    this.gifRender();
                    break;
                default:
                    // ignore
                    break;
            }
            return;
        }

        // TODO shakao: streamline recording state to only be for adding frame?
        if (this.state.recordingState == ShareRecordingState.GifRecording) {
            if (this._gifEncoder.addFrame(msg.data, msg.delay))
                this.gifRender();
        } else if (this.state.recordingState == ShareRecordingState.ScreenshotSnap || this.state.recordingState === ShareRecordingState.None) {
            // received a screenshot
            this.setState({ screenshotUri: pxt.BrowserUtils.imageDataToPNG(msg.data), recordingState: ShareRecordingState.None, recordError: undefined })
        } else {
            // ignore
            // make sure simulator is stopped
            simulator.driver.stopRecording();
        }
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

    componentDidMount() {
        document.addEventListener("keydown", this.handleKeyDown);
    }

    componentWillUnmount() {
        document.removeEventListener("keydown", this.handleKeyDown);
    }

    shouldComponentUpdate(nextProps: ShareEditorProps, nextState: ShareEditorState, nextContext: any): boolean {
        return this.state.visible != nextState.visible
            || this.state.mode != nextState.mode
            || this.state.pubId != nextState.pubId
            || this.state.sharingError !== nextState.sharingError
            || this.state.projectName != nextState.projectName
            || this.state.projectNameChanged != nextState.projectNameChanged
            || this.state.loading != nextState.loading
            || this.state.recordingState != nextState.recordingState
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

    handleScreenshotClick() {
        pxt.tickEvent("share.takescreenshot", { view: 'computer', collapsedTo: '' + !this.props.parent.state.collapseEditorTools }, { interactiveConsent: true });
        if (this.state.recordingState != ShareRecordingState.None) return;

        this.setState({ recordingState: ShareRecordingState.ScreenshotSnap, recordError: undefined },
            () => this.screenshotAsync());
    }

    screenshotAsync = () => {
        return this.props.parent.requestScreenshotAsync()
            .then(img => {
                const st: ShareEditorState = { recordingState: ShareRecordingState.None, recordError: undefined };
                if (img) st.screenshotUri = img;
                else st.recordError = lf("Oops, screenshot failed. Please try again.")
                this.setState(st);
            });
    }

    handleRecordClick() {
        switch (this.state.recordingState) {
            case ShareRecordingState.None:
                this.gifRecord();
                break;
            case ShareRecordingState.GifRecording:
                this.gifRender();
                break;
            default:
                // ignore
                break;
        }
    }

    private loadEncoderAsync(): Promise<screenshot.GifEncoder> {
        if (this._gifEncoder) return Promise.resolve(this._gifEncoder);
        return screenshot.loadGifEncoderAsync()
            .then(encoder => this._gifEncoder = encoder);
    }

    gifRecord = async () => {
        pxt.tickEvent("share.gifrecord", { view: 'computer', collapsedTo: '' + !this.props.parent.state.collapseEditorTools }, { interactiveConsent: true });

        if (this.state.recordingState != ShareRecordingState.None) return;

        this.setState({ recordingState: ShareRecordingState.GifLoading }, async () => {
            try {
                const encoder = await this.loadEncoderAsync();
                if (!encoder) {
                    this.setState({
                        recordingState: ShareRecordingState.None,
                        recordError: lf("Oops, gif encoder could not load. Please try again.")
                    });
                } else {
                    encoder.start();
                    const gifwidth = pxt.appTarget.appTheme.simGifWidth || 160;
                    this.setState({ recordingState: ShareRecordingState.GifRecording },
                        () => simulator.driver.startRecording(gifwidth));
                }
            } catch (e: any) {
                pxt.reportException(e);
                this.setState({
                    recordingState: ShareRecordingState.None,
                    recordError: lf("Oops, gif recording failed. Please try again.")
                });
                // TODO shakao: note error
                if (this._gifEncoder) {
                    this._gifEncoder.cancel();
                }
            }
        });
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

        this.setState({ recordingState: ShareRecordingState.None })
        // TODO shakao return error
        return uri;
    }

    handleCreateGitHubRepository() {
        pxt.tickEvent("share.github.create", undefined, { interactiveConsent: true });
        this.hide();
        this.props.parent.createGitHubRepositoryAsync();
    }

    protected async getShareUrl(pubId: string) {
        const targetTheme = pxt.appTarget.appTheme;
        const header = this.props.parent.state.header;
        let shareData: ShareData = {
            url: "",
            embed: {}
        };

        let shareUrl = targetTheme.shareUrl || "https://makecode.com/";
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
        const light = !!pxt.options.light;

        const screenshotAsync = async () => await this.props.parent.requestScreenshotAsync();
        const publishAsync = async (name: string, screenshotUri?: string) => {
            if (name && parent.state.projectName != name) {
                await parent.updateHeaderNameAsync(name);
            }
            try {
                const id = await parent.anonymousPublishAsync(screenshotUri);
                return await this.getShareUrl(id);
            } catch (e) {
                return { url: "", embed: {}, error: e } as ShareData
            }
        }

        return visible
            ? <Modal
                title={lf("Share Project")}
                fullscreen={simScreenshot || simGif} // TODO only fullsreen if simulator
                className="sharedialog"
                parentElement={document.getElementById("root") || undefined}
                onClose={this.hide}>
                <Share projectName={newProjectName}
                    showModalAsync={core.dialogAsync}
                    screenshotUri={screenshotUri}
                    screenshotAsync={simScreenshot ? screenshotAsync : undefined}
                    gifRecordAsync={!light && simGif ? this.gifRecord : undefined}
                    gifRenderAsync={!light && simGif ? this.gifRender : undefined}
                    publishAsync={publishAsync} />
            </Modal>
            : <></>
    }

    componentDidUpdate() {
        const container = document.getElementById("shareLoanedSimulator");
        if (container && this.loanedSimulator && !this.loanedSimulator.parentNode) {
            container.appendChild(this.loanedSimulator);
        }

        const { screenshotUri, visible } = this.state;
        const targetTheme = pxt.appTarget.appTheme;
        if (visible && this.loanedSimulator && targetTheme.simScreenshot && !screenshotUri) {
            this.screenshotAsync().then(() => this.forceUpdate());
        }
    }

    protected handleKeyDown = (e: KeyboardEvent) => {
        const { visible } = this.state;
        const targetTheme = pxt.appTarget.appTheme;
        const pressed = e.key.toLocaleLowerCase();

        // Don't fire events if component is hidden or if they are typing in a name
        if (!visible || (document.activeElement && document.activeElement.tagName === "INPUT")) return;

        if (targetTheme.simScreenshotKey && pressed === targetTheme.simScreenshotKey.toLocaleLowerCase()) {
            this.handleScreenshotClick();
        }
        else if (targetTheme.simGifKey && pressed === targetTheme.simGifKey.toLocaleLowerCase()) {
            this.handleRecordClick();
        }
    }
}

interface SocialButtonProps {
    url?: string;
    type?: "facebook" | "twitter" | "discourse";
    icon?: string; // override type
    label?: string;
    ariaLabel?: string;
    heading?: string;
}

class SocialButton extends data.Component<SocialButtonProps, {}> {
    constructor(props: SocialButtonProps) {
        super(props);
        this.state = {
        }

        this.handleClick = this.handleClick.bind(this);
    }

    handleClick(e: React.MouseEvent<any>) {
        const { type, url: shareUrl, heading } = this.props;

        const socialOptions = pxt.appTarget.appTheme.socialOptions;
        pxt.tickEvent(`share.${type}`, undefined, { interactiveConsent: true })

        let url = '';
        switch (type) {
            case "facebook": {
                url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
                break;
            }
            case "twitter": {
                let twitterText = lf("Check out what I made!");
                if (socialOptions.twitterHandle && socialOptions.orgTwitterHandle) {
                    twitterText = lf("Check out what I made with @{0} and @{1}!", socialOptions.twitterHandle, socialOptions.orgTwitterHandle);
                } else if (socialOptions.twitterHandle) {
                    twitterText = lf("Check out what I made with @{0}!", socialOptions.twitterHandle);
                } else if (socialOptions.orgTwitterHandle) {
                    twitterText = lf("Check out what I made with @{0}!", socialOptions.orgTwitterHandle);
                }
                url = `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}` +
                    `&text=${encodeURIComponent(twitterText)}` +
                    (socialOptions.hashtags ? `&hashtags=${encodeURIComponent(socialOptions.hashtags)}` : '') +
                    (socialOptions.related ? `&related=${encodeURIComponent(socialOptions.related)}` : '');
                break;
            }
            case "discourse": {
                // https://meta.discourse.org/t/compose-a-new-pre-filled-topic-via-url/28074
                url = `${socialOptions.discourse || "https://forum.makecode.com/"}new-topic?title=${encodeURIComponent(shareUrl)}`;
                if (socialOptions.discourseCategory)
                    url += `&category=${encodeURIComponent(socialOptions.discourseCategory)}`;
                break;
            }
        }
        pxt.BrowserUtils.popupWindow(url, heading, 600, 600);
        e.preventDefault();
    }

    renderCore() {
        const { type, label, ariaLabel, icon } = this.props;
        return <a role="button" className={`ui button large ${label ? "labeled" : ""} icon ${type}`} tabIndex={0} aria-label={ariaLabel}
            onClick={this.handleClick} onKeyDown={fireClickOnEnter}><sui.Icon icon={icon || type} />{label}</a>
    }
}

interface EmbedMenuItemProps {
    label: string;
    mode: ShareMode;
    currentMode: ShareMode;
    onClick: (mode: ShareMode) => void;
}

class EmbedMenuItem extends sui.StatelessUIElement<EmbedMenuItemProps> {
    constructor(props: EmbedMenuItemProps) {
        super(props);

        this.handleClick = this.handleClick.bind(this);
    }

    handleClick() {
        this.props.onClick(this.props.mode);
    }

    renderCore() {
        const { label, mode, currentMode } = this.props;
        return <sui.MenuItem id={`tab${mode}`} active={currentMode == mode} tabIndex={0} name={label} onClick={this.handleClick} />
    }
}
