import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";
import * as simulator from "./simulator";
import * as screenshot from "./screenshot";

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
    advancedMenu?: boolean;
    mode?: ShareMode;
    pubId?: string;
    visible?: boolean;
    sharingError?: boolean;
    loading?: boolean;
    projectName?: string;
    projectNameChanged?: boolean;
    thumbnails?: boolean;
    screenshotUri?: string;
    recordingState?: ShareRecordingState;
    recordError?: string;
}

export class ShareEditor extends data.Component<ShareEditorProps, ShareEditorState> {
    private loanedSimulator: HTMLElement;
    private _gifEncoder: screenshot.GifEncoder;

    constructor(props: ShareEditorProps) {
        super(props);
        this.state = {
            pubId: undefined,
            visible: false,
            advancedMenu: false,
            screenshotUri: undefined,
            recordingState: ShareRecordingState.None,
            recordError: undefined
        }

        this.hide = this.hide.bind(this);
        this.toggleAdvancedMenu = this.toggleAdvancedMenu.bind(this);
        this.setAdvancedMode = this.setAdvancedMode.bind(this);
        this.handleProjectNameChange = this.handleProjectNameChange.bind(this);
        this.restartSimulator = this.restartSimulator.bind(this);
        this.handleRecordClick = this.handleRecordClick.bind(this);
        this.handleScreenshotClick = this.handleScreenshotClick.bind(this);
        this.handleScreenshotMessage = this.handleScreenshotMessage.bind(this);
    }

    hide() {
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
            recordError: undefined
        });
    }

    show(header: pxt.workspace.Header) {
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
            sharingError: false,
            screenshotUri: undefined
        }, thumbnails ? (() => this.props.parent.startSimulator()) : undefined);
    }

    handleScreenshotMessage(msg: pxt.editor.ScreenshotData) {
        if (!msg) return;

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

        if (this.state.recordingState == ShareRecordingState.GifRecording) {
            if (this._gifEncoder.addFrame(msg.data, msg.delay))
                this.gifRender();
        } else if (this.state.recordingState == ShareRecordingState.ScreenshotSnap) {
            // received a screenshot
            this.setState({ screenshotUri: pxt.BrowserUtils.imageDataToPNG(msg.data), recordingState: ShareRecordingState.None, recordError: undefined })
        } else {
            // ignore
            // make sure simulator is stopped
            simulator.driver.stopRecording();
        }
    }

    componentWillReceiveProps(newProps: ShareEditorProps) {
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
            || this.state.advancedMenu != nextState.advancedMenu
            || this.state.mode != nextState.mode
            || this.state.pubId != nextState.pubId
            || this.state.sharingError != nextState.sharingError
            || this.state.projectName != nextState.projectName
            || this.state.projectNameChanged != nextState.projectNameChanged
            || this.state.loading != nextState.loading
            || this.state.recordingState != nextState.recordingState
            || this.state.screenshotUri != nextState.screenshotUri;
    }

    private toggleAdvancedMenu() {
        const advancedMenu = !!this.state.advancedMenu;
        this.setState({ advancedMenu: !advancedMenu });
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
            () => {
                this.props.parent.requestScreenshotAsync()
                    .then(img => {
                        const st: ShareEditorState = { recordingState: ShareRecordingState.None, recordError: undefined };
                        if (img) st.screenshotUri = img;
                        else st.recordError = lf("Oops, screenshot failed. Please try again.")
                        this.setState(st);
                    });

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

    gifRecord() {
        pxt.tickEvent("share.gifrecord", { view: 'computer', collapsedTo: '' + !this.props.parent.state.collapseEditorTools }, { interactiveConsent: true });

        if (this.state.recordingState != ShareRecordingState.None) return;

        this.setState({ recordingState: ShareRecordingState.GifLoading, screenshotUri: undefined },
            () => this.loadEncoderAsync()
                .then(encoder => {
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
                })
                .catch(e => {
                    pxt.reportException(e);
                    this.setState({
                        recordingState: ShareRecordingState.None,
                        recordError: lf("Oops, gif recording failed. Please try again.")
                    });
                    if (this._gifEncoder) {
                        this._gifEncoder.cancel();
                    }
                })
        );
    }

    gifRender() {
        pxt.debug(`render gif`)
        simulator.driver.stopRecording();
        if (!this._gifEncoder) return;

        this.setState({ recordingState: ShareRecordingState.GifRendering, recordError: undefined },
            () => {
                this.props.parent.stopSimulator();
                this._gifEncoder.renderAsync()
                    .then(uri => {
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

                        this.setState({ recordingState: ShareRecordingState.None, screenshotUri: uri, recordError })
                        // give a breather to the browser to render the gif
                        Promise.delay(1000).then(() => this.props.parent.startSimulator());
                    })
            });
    }

    renderCore() {
        const { visible, projectName: newProjectName, loading, recordingState, screenshotUri, thumbnails, recordError, pubId } = this.state;
        const targetTheme = pxt.appTarget.appTheme;
        const header = this.props.parent.state.header;
        const advancedMenu = !!this.state.advancedMenu;
        const hideEmbed = !!targetTheme.hideShareEmbed;
        const showSocialIcons = !!targetTheme.socialOptions && !pxt.BrowserUtils.isUwpEdge();
        const ready = !!pubId;
        let mode = this.state.mode;
        let url = '';
        let embed = '';

        if (header) {
            let shareUrl = pxt.appTarget.appTheme.shareUrl || "https://makecode.com/";
            if (!/\/$/.test(shareUrl)) shareUrl += '/';
            let rootUrl = pxt.appTarget.appTheme.embedUrl
            if (!/\/$/.test(rootUrl)) rootUrl += '/';
            const verPrefix = pxt.webConfig.verprefix || '';

            if (ready) {
                url = `${shareUrl}${pubId}`;
                let editUrl = `${rootUrl}${verPrefix}#pub:${pubId}`;
                switch (mode) {
                    case ShareMode.Code:
                        embed = pxt.docs.codeEmbedUrl(`${rootUrl}${verPrefix}`, pubId);
                        break;
                    case ShareMode.Editor:
                        embed = pxt.docs.embedUrl(`${rootUrl}${verPrefix}`, "pub", pubId);
                        break;
                    case ShareMode.Simulator:
                        let padding = '81.97%';
                        // TODO: parts aspect ratio
                        if (pxt.appTarget.simulator) padding = (100 / pxt.appTarget.simulator.aspectRatio).toPrecision(4) + '%';
                        const runUrl = rootUrl + (pxt.webConfig.runUrl || `${verPrefix}--run`).replace(/^\//, '');
                        embed = pxt.docs.runUrl(runUrl, padding, pubId);
                        break;
                    case ShareMode.Url:
                        embed = editUrl;
                        break;
                }
            }
        }
        const publish = () => {
            pxt.tickEvent("menu.embed.publish", undefined, { interactiveConsent: true });
            this.setState({ sharingError: false, loading: true });
            let p = Promise.resolve();
            if (newProjectName && this.props.parent.state.projectName != newProjectName) {
                // save project name if we've made a change change
                p = this.props.parent.updateHeaderNameAsync(newProjectName);
            }
            p.then(() => this.props.parent.anonymousPublishAsync(screenshotUri))
                .then((id) => {
                    this.setState({ pubId: id });
                    this.forceUpdate();
                })
                .catch((e) => {
                    this.setState({
                        pubId: undefined,
                        sharingError: true
                    });
                });
            this.forceUpdate();
        }

        const formats = [
            { mode: ShareMode.Code, label: lf("Code") },
            { mode: ShareMode.Editor, label: lf("Editor") },
            { mode: ShareMode.Simulator, label: lf("Simulator") },
        ];

        const action = !ready ? lf("Publish project") : undefined;
        const actionLoading = loading && !this.state.sharingError;

        let actions: sui.ModalButton[] = [];
        if (action) {
            actions.push({
                label: action,
                onclick: publish,
                icon: 'share alternate',
                loading: actionLoading,
                className: 'primary',
                disabled: recordingState != ShareRecordingState.None
            })
        }

        const light = !!pxt.options.light;
        const disclaimer = lf("You need to publish your project to share it or embed it in other web pages.") + " " +
            lf("You acknowledge having consent to publish this project.");
        const screenshotDisabled = actionLoading || recordingState != ShareRecordingState.None;
        const screenshotText = this.loanedSimulator && targetTheme.simScreenshotKey
            ? lf("Take Screenshot (shortcut: {0})", targetTheme.simScreenshotKey) : lf("Take Screenshot");
        const screenshot = !light && targetTheme.simScreenshot;
        const gif = !light && !!targetTheme.simGif;
        const isGifRecording = recordingState == ShareRecordingState.GifRecording;
        const isGifRendering = recordingState == ShareRecordingState.GifRendering;
        const gifIcon = isGifRecording ? "stop" : "circle";
        const gifTitle = isGifRecording
            ? (targetTheme.simGifKey ? lf("Stop recording (shortcut: {0})", targetTheme.simGifKey) : lf("Stop recording"))
            : isGifRendering ? lf("Cancel rendering")
                : (targetTheme.simGifKey ? lf("Start recording (shortcut: {0})", targetTheme.simGifKey)
                    : lf("Start recording"));
        const gifRecordingClass = isGifRecording ? "glow" : "";
        const gifDisabled = actionLoading;
        const gifLoading = recordingState == ShareRecordingState.GifLoading
            || isGifRendering;
        const screenshotMessage = recordError ? recordError
            : isGifRecording ? lf("Recording in progress...")
                : isGifRendering ? lf("Rendering gif...")
                    : undefined;
        const screenshotMessageClass = recordError ? "warning" : "";

        return (
            <sui.Modal isOpen={visible} className="sharedialog"
                size={thumbnails ? "" : "small"}
                onClose={this.hide}
                dimmer={true} header={lf("Share Project")}
                closeIcon={true} buttons={actions}
                closeOnDimmerClick
                closeOnDocumentClick
                closeOnEscape>
                <div className={`ui form`}>
                    {action && !this.loanedSimulator ? <div className="ui field">
                        <div>
                            <sui.Input ref="filenameinput" placeholder={lf("Name")} autoFocus={!pxt.BrowserUtils.isMobile()} id={"projectNameInput"}
                                ariaLabel={lf("Type a name for your project")} autoComplete={false}
                                value={newProjectName || ''} onChange={this.handleProjectNameChange} />
                        </div>
                    </div> : undefined}
                    {action && this.loanedSimulator ? <div className="ui fields">
                        <div id="shareLoanedSimulator" className={`ui six wide field landscape only ${gifRecordingClass}`}></div>
                        <div className="ui ten wide field">
                            <sui.Input ref="filenameinput" placeholder={lf("Name")} autoFocus={!pxt.BrowserUtils.isMobile()} id={"projectNameInput"}
                                ariaLabel={lf("Type a name for your project")} autoComplete={false}
                                value={newProjectName || ''} onChange={this.handleProjectNameChange} />
                            <label></label>
                            <div className="ui buttons landscape only">
                                <sui.Button icon="refresh" title={lf("Restart")} ariaLabel={lf("Restart")} onClick={this.restartSimulator} disabled={screenshotDisabled} />
                                {screenshot ? <sui.Button icon="camera" title={screenshotText} ariaLabel={screenshotText} onClick={this.handleScreenshotClick} disabled={screenshotDisabled} /> : undefined}
                                {gif ? <sui.Button icon={gifIcon} title={gifTitle} loading={gifLoading} onClick={this.handleRecordClick} disabled={gifDisabled} /> : undefined}
                            </div>
                            {screenshotUri || screenshotMessage ?
                                <div className={`ui ${screenshotMessageClass} segment landscape only`}>{
                                    (screenshotUri && !screenshotMessage)
                                        ? <img className="ui small centered image" src={screenshotUri} alt={lf("Recorded gif")} />
                                        : <p className="no-select">{screenshotMessage}</p>}</div> : undefined}
                        </div>
                    </div> : undefined}
                    {action ? <p className="ui tiny message info">{disclaimer}</p> : undefined}
                    {this.state.sharingError ?
                        <p className="ui red inverted segment">{lf("Oops! There was an error. Please ensure you are connected to the Internet and try again.")}</p>
                        : undefined}
                    {url && ready ? <div>
                        <p>{lf("Your project is ready! Use the address below to share your projects.")}</p>
                        <sui.Input id="projectUri" class="mini" readOnly={true} lines={1} value={url} copy={true} selectOnClick={true} aria-describedby="projectUriLabel" autoComplete={false} />
                        <label htmlFor="projectUri" id="projectUriLabel" className="accessible-hidden">{lf("This is the read-only internet address of your project.")}</label>
                        {showSocialIcons ? <div className="social-icons">
                            <SocialButton url={url} ariaLabel="Facebook" type='facebook' heading={lf("Share on Facebook")} />
                            <SocialButton url={url} ariaLabel="Twitter" type='twitter' heading={lf("Share on Twitter")} />
                        </div> : undefined}
                    </div> : undefined}
                    {ready && !hideEmbed ? <div>
                        <div className="ui divider"></div>
                        <sui.Link icon={`chevron ${advancedMenu ? "down" : "right"}`} text={lf("Embed")} ariaExpanded={advancedMenu} onClick={this.toggleAdvancedMenu} />
                        {advancedMenu ?
                            <sui.Menu pointing secondary>
                                {formats.map(f =>
                                    <EmbedMenuItem key={`tab${f.label}`} onClick={this.setAdvancedMode} currentMode={mode} {...f} />)}
                            </sui.Menu> : undefined}
                        {advancedMenu ?
                            <sui.Field>
                                <sui.Input id="embedCode" class="mini" readOnly={true} lines={4} value={embed} copy={ready} disabled={!ready} selectOnClick={true} autoComplete={false} />
                                <label htmlFor="embedCode" id="embedCodeLabel" className="accessible-hidden">{lf("This is the read-only code for the selected tab.")}</label>
                            </sui.Field> : null}
                    </div> : undefined}
                </div>
            </sui.Modal >
        )
    }

    componentDidUpdate() {
        const container = document.getElementById("shareLoanedSimulator");
        if (container && this.loanedSimulator && !this.loanedSimulator.parentNode)
            container.appendChild(this.loanedSimulator);
    }
}

interface SocialButtonProps {
    url?: string;
    type?: "facebook" | "twitter";
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

        let twitterText = lf("Check out what I made!");
        const socialOptions = pxt.appTarget.appTheme.socialOptions;
        if (socialOptions.twitterHandle && socialOptions.orgTwitterHandle) {
            twitterText = lf("Check out what I made with @{0} and @{1}!", socialOptions.twitterHandle, socialOptions.orgTwitterHandle);
        } else if (socialOptions.twitterHandle) {
            twitterText = lf("Check out what I made with @{0}!", socialOptions.twitterHandle);
        } else if (socialOptions.orgTwitterHandle) {
            twitterText = lf("Check out what I made with @{0}!", socialOptions.orgTwitterHandle);
        }
        const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        const twitterUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}` +
            `&text=${encodeURIComponent(twitterText)}` +
            (socialOptions.hashtags ? `&hashtags=${encodeURIComponent(socialOptions.hashtags)}` : '') +
            (socialOptions.related ? `&related=${encodeURIComponent(socialOptions.related)}` : '');

        pxt.tickEvent(`share.${type}`, undefined, { interactiveConsent: true })

        let url = '';
        switch (type) {
            case "facebook": url = fbUrl; break;
            case "twitter": url = twitterUrl; break;
        }
        pxt.BrowserUtils.popupWindow(url, heading, 600, 600);
        e.preventDefault();
    }

    renderCore() {
        const { type, ariaLabel } = this.props;
        return <a role="button" className={`ui button large icon ${type}`} tabIndex={0} aria-label={ariaLabel}
            onClick={this.handleClick}><sui.Icon icon={type} /></a>
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
        return <sui.MenuItem id={`tab${mode}`} active={currentMode == mode} name={label} onClick={this.handleClick} />
    }
}