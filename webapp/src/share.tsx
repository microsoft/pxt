import * as React from "react";
import * as ReactDOM from "react-dom";
import * as data from "./data";
import * as sui from "./sui";
import * as pkg from "./package";
import * as blocks from "./blocks"

type ISettingsProps = pxt.editor.ISettingsProps;
type IAppProps = pxt.editor.IAppProps;
type IAppState = pxt.editor.IAppState;
type IProjectView = pxt.editor.IProjectView;

export enum ShareMode {
    Screenshot,
    Url,
    Editor,
    Simulator,
    Cli
}

export interface ShareEditorState {
    advancedMenu?: boolean;
    mode?: ShareMode;
    screenshotId?: string;
    screenshotUri?: string;
    currentPubId?: string;
    pubCurrent?: boolean;
    visible?: boolean;
}

export class ShareEditor extends data.Component<ISettingsProps, ShareEditorState> {
    constructor(props: ISettingsProps) {
        super(props);
        this.state = {
            currentPubId: undefined,
            pubCurrent: false,
            visible: false,
            advancedMenu: false
        }
    }

    hide() {
        this.setState({ visible: false });
    }

    show(header: pxt.workspace.Header) {
        this.setState({ visible: true, mode: ShareMode.Screenshot, pubCurrent: header.pubCurrent });
    }

    shouldComponentUpdate(nextProps: ISettingsProps, nextState: ShareEditorState, nextContext: any): boolean {
        return this.state.visible != nextState.visible
            || this.state.advancedMenu != nextState.advancedMenu
            || this.state.mode != nextState.mode
            || this.state.pubCurrent != nextState.pubCurrent
            || this.state.screenshotId != nextState.screenshotId
            || this.state.currentPubId != nextState.currentPubId;
    }

    renderCore() {
        const { visible } = this.state;

        const cloud = pxt.appTarget.cloud || {};
        const embedding = !!cloud.embedding;
        const header = this.props.parent.state.header;
        const advancedMenu = !!this.state.advancedMenu;

        let ready = false;
        let mode = this.state.mode;
        let url = '';
        let embed = '';
        let help = lf("Copy this HTML to your website or blog.");

        if (header) {
            let rootUrl = pxt.appTarget.appTheme.embedUrl
            if (!/\/$/.test(rootUrl)) rootUrl += '/';

            const isBlocks = this.props.parent.getPreferredEditor() == pxt.BLOCKS_PROJECT_NAME;
            const pubCurrent = header ? header.pubCurrent : false;
            let currentPubId = (header ? header.pubId : undefined) || this.state.currentPubId;

            ready = (!!currentPubId && header.pubCurrent);
            if (ready) {
                url = `${rootUrl}${header.pubId}`;
                let editUrl = `${rootUrl}#pub:${currentPubId}`;
                switch (mode) {
                    case ShareMode.Cli:
                        embed = `pxt target ${pxt.appTarget.id}
pxt extract ${url}`;
                        help = lf("Run this command from a shell.");
                        break;
                    case ShareMode.Editor:
                        embed = pxt.docs.embedUrl(rootUrl, "pub", header.pubId);
                        break;
                    case ShareMode.Simulator:
                        let padding = '81.97%';
                        // TODO: parts aspect ratio
                        if (pxt.appTarget.simulator) padding = (100 / pxt.appTarget.simulator.aspectRatio).toPrecision(4) + '%';
                        const runUrl = rootUrl + (pxt.webConfig.runUrl || "--run").replace(/^\//, '');
                        embed = pxt.docs.runUrl(runUrl, padding, header.pubId);
                        break;
                    case ShareMode.Url:
                        embed = editUrl;
                        break;
                    default:
                        if (isBlocks) {
                            // Render screenshot
                            if (this.state.screenshotId == currentPubId) {
                                if (this.state.screenshotUri)
                                    embed = `<a href="${editUrl}"><img src="${this.state.screenshotUri}" /></a>`
                                else embed = lf("Ooops, no screenshot available.");
                            } else {
                                pxt.debug("rendering share-editor screenshot png");
                                embed = lf("rendering...");
                                pxt.blocks.layout.toPngAsync((this.props.parent.editor as blocks.Editor).editor)
                                    .done(uri => this.setState({ screenshotId: currentPubId, screenshotUri: uri }));
                            }
                        } else {
                            // Render javascript code
                            pxt.debug("rendering share-editor javascript markdown");
                            embed = lf("rendering...")
                            let main = pkg.getEditorPkg(pkg.mainPkg)
                            let file = main.getMainFile()
                            if (pkg.File.blocksFileNameRx.test(file.getName()) && file.getVirtualFileName())
                                file = main.lookupFile("this/" + file.getVirtualFileName()) || file
                            if (pkg.File.tsFileNameRx.test(file.getName())) {
                                let fileContents = file.content;
                                let mdContent = pxt.docs.renderMarkdown(`@body@`, `\`\`\`javascript\n${fileContents}\n\`\`\``);
                                embed = `<a style="text-decoration: none;" href="${editUrl}">${mdContent}</a>`;
                            }
                        }
                        break;
                }
            }

        }
        const publish = () => {
            pxt.tickEvent("menu.embed.publish");
            this.props.parent.anonymousPublishAsync().done(() => {
                this.setState({ pubCurrent: true });
            });
            this.forceUpdate();
        }

        const formats = [{ mode: ShareMode.Screenshot, label: lf("Screenshot") },
            { mode: ShareMode.Editor, label: lf("Editor") },
            { mode: ShareMode.Simulator, label: lf("Simulator") },
            { mode: ShareMode.Cli, label: lf("Command line") }
        ];

        const action = !ready ? lf("Publish project") : undefined;
        const actionLoading = this.props.parent.state.publishing;

        return (
            <sui.Modal open={this.state.visible} className="sharedialog" header={lf("Share Project") } size="small"
                onClose={() => this.setState({ visible: false }) } dimmer={true}
                action={action}
                actionClick={publish}
                actionLoading={actionLoading}
                closeIcon={true}
                closeOnDimmerClick closeOnDocumentClick
                >
                <div className={`ui form`}>
                    { action ?
                        <p>{lf("You need to publish your project to share it or embed it in other web pages.") +
                            lf("You acknowledge having consent to publish this project.") }</p>
                        : undefined }
                    { url && ready ? <div>
                        <p>{lf("Your project is ready! Use the address below to share your projects.") }</p>
                        <sui.Input class="mini" readOnly={true} lines={1} value={url} copy={true} />
                    </div>
                        : undefined }
                    { ready ? <div>
                        <div className="ui divider"></div>
                        <sui.Button class="labeled" icon={`chevron ${advancedMenu ? "down" : "right"}`} text={lf("Embed") } onClick={() => this.setState({ advancedMenu: !advancedMenu }) } />
                        { advancedMenu ?
                            <sui.Menu pointing secondary>
                                {formats.map(f =>
                                    <sui.MenuItem key={`tab${f.label}`} active={mode == f.mode} name={f.label} onClick={() => this.setState({ mode: f.mode }) } />) }
                            </sui.Menu> : undefined }
                        { advancedMenu ?
                            <sui.Field>
                                <sui.Input class="mini" readOnly={true} lines={4} value={embed} copy={ready} disabled={!ready} />
                            </sui.Field> : null }
                    </div> : undefined }
                </div>
            </sui.Modal>
        )
    }
}
