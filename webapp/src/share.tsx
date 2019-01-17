import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";
import * as simulator from "./simulator";

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
    advancedMenu?: boolean;
    mode?: ShareMode;
    currentPubId?: string;
    pubCurrent?: boolean;
    visible?: boolean;
    sharingError?: boolean;
    loading?: boolean;
    projectName?: string;
    projectNameChanged?: boolean;
    thumbnails?: boolean;
    takingScreenshot?: boolean;
    screenshotUri?: string;
}

export class ShareEditor extends data.Component<ShareEditorProps, ShareEditorState> {
    private loanedSimulator: HTMLElement;
    constructor(props: ShareEditorProps) {
        super(props);
        this.state = {
            currentPubId: undefined,
            pubCurrent: false,
            visible: false,
            advancedMenu: false,
            screenshotUri: undefined
        }

        this.hide = this.hide.bind(this);
        this.toggleAdvancedMenu = this.toggleAdvancedMenu.bind(this);
        this.setAdvancedMode = this.setAdvancedMode.bind(this);
        this.handleProjectNameChange = this.handleProjectNameChange.bind(this);
        this.restartSimulator = this.restartSimulator.bind(this);
        this.takeScreenshot = this.takeScreenshot.bind(this);
        this.handleScreenshot = this.handleScreenshot.bind(this);
    }

    hide() {
        if (this.loanedSimulator) {
            simulator.driver.unloanSimulator();
            this.loanedSimulator = undefined;
            this.props.parent.popScreenshotHandler();
        }
        this.setState({
            visible: false,
            screenshotUri: undefined,
            projectName: undefined,
            projectNameChanged: false
        });
    }

    show(header: pxt.workspace.Header) {
        // TODO investigate why edge does not render well
        // upon hiding dialog, the screen does not redraw properly
        const thumbnails = pxt.appTarget.cloud && pxt.appTarget.cloud.thumbnails;
        if (thumbnails) {
            this.loanedSimulator = simulator.driver.loanSimulator();
            this.props.parent.pushScreenshotHandler(this.handleScreenshot);
        }
        this.setState({
            thumbnails,
            visible: true,
            mode: ShareMode.Code,
            pubCurrent: header.pubCurrent,
            sharingError: false,
            screenshotUri: undefined
        }, () => this.props.parent.startSimulator());
    }

    handleScreenshot(img: string) {
        if (img)
            this.setState({ screenshotUri: img });
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
            || this.state.pubCurrent != nextState.pubCurrent
            || this.state.currentPubId != nextState.currentPubId
            || this.state.sharingError != nextState.sharingError
            || this.state.projectName != nextState.projectName
            || this.state.projectNameChanged != nextState.projectNameChanged
            || this.state.loading != nextState.loading
            || this.state.takingScreenshot != nextState.takingScreenshot
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

    takeScreenshot() {
        pxt.tickEvent("shakre.takescreenshot", { view: 'computer', collapsedTo: '' + !this.props.parent.state.collapseEditorTools }, { interactiveConsent: true });
        if (this.state.takingScreenshot) return;
        this.refreshScreenshot();
    }

    private refreshScreenshot() {
        if (!this.state.thumbnails || this.state.takingScreenshot)
            return;

        this.setState({ takingScreenshot: true })
        this.props.parent.requestScreenshotAsync()
            .then(img => {
                const st: ShareEditorState = { takingScreenshot: false };
                if (img) st.screenshotUri = img;
                this.setState(st);
            });
    }

    renderCore() {
        const { visible, projectName: newProjectName, loading, takingScreenshot, screenshotUri, thumbnails } = this.state;
        const targetTheme = pxt.appTarget.appTheme;
        const header = this.props.parent.state.header;
        const advancedMenu = !!this.state.advancedMenu;
        const hideEmbed = !!targetTheme.hideShareEmbed;
        const showSocialIcons = !!targetTheme.socialOptions && !pxt.BrowserUtils.isUwpEdge();

        let ready = false;
        let mode = this.state.mode;
        let url = '';
        let embed = '';

        if (header) {
            let shareUrl = pxt.appTarget.appTheme.shareUrl || "https://makecode.com/";
            if (!/\/$/.test(shareUrl)) shareUrl += '/';
            let rootUrl = pxt.appTarget.appTheme.embedUrl
            if (!/\/$/.test(rootUrl)) rootUrl += '/';
            let currentPubId = (header ? header.pubId : undefined) || this.state.currentPubId;
            const verPrefix = pxt.webConfig.verprefix || '';

            ready = (!!currentPubId && header.pubCurrent);
            if (ready) {
                url = `${shareUrl}${currentPubId}`;
                let editUrl = `${rootUrl}${verPrefix}#pub:${currentPubId}`;
                switch (mode) {
                    case ShareMode.Code:
                        embed = pxt.docs.codeEmbedUrl(`${rootUrl}${verPrefix}`, header.pubId);
                        break;
                    case ShareMode.Editor:
                        embed = pxt.docs.embedUrl(`${rootUrl}${verPrefix}`, "pub", header.pubId);
                        break;
                    case ShareMode.Simulator:
                        let padding = '81.97%';
                        // TODO: parts aspect ratio
                        if (pxt.appTarget.simulator) padding = (100 / pxt.appTarget.simulator.aspectRatio).toPrecision(4) + '%';
                        const runUrl = rootUrl + (pxt.webConfig.runUrl || `${verPrefix}--run`).replace(/^\//, '');
                        embed = pxt.docs.runUrl(runUrl, padding, header.pubId);
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
                .then(() => {
                    this.setState({ pubCurrent: true });
                    this.forceUpdate();
                })
                .catch((e) => {
                    this.setState({ sharingError: true });
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
                className: 'primary'
            })
        }

        const disclaimer = lf("You need to publish your project to share it or embed it in other web pages.") + " " +
            lf("You acknowledge having consent to publish this project.");
        const screenshotText = this.loanedSimulator && targetTheme.simScreenshotKey
            ? lf("Take Screenshot (shortcut: {0})", targetTheme.simScreenshotKey) : lf("Take Screenshot");

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
                        <div id="shareLoanedSimulator" className="ui six wide field landscape only"></div>
                        <div className="ui ten wide field">
                            <div>
                                <sui.Input ref="filenameinput" placeholder={lf("Name")} autoFocus={!pxt.BrowserUtils.isMobile()} id={"projectNameInput"}
                                    ariaLabel={lf("Type a name for your project")} autoComplete={false}
                                    value={newProjectName || ''} onChange={this.handleProjectNameChange} />
                            </div>
                            <div className="ui segment landscape only">{screenshotUri
                                ? <img className="ui centered image pixelart" src={screenshotUri} alt={lf("Screenshot")} />
                                : <p>{lf("No screenshot!")}</p>}</div>
                            <div className="ui buttons landscape only">
                                <sui.Button icon="refresh" title={lf("Restart")} ariaLabel={lf("Restart")} onClick={this.restartSimulator} loading={takingScreenshot} />
                                <sui.Button icon="camera" title={screenshotText} ariaLabel={screenshotText} onClick={this.takeScreenshot} loading={takingScreenshot} />
                            </div>
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