/// <reference path="app.d.ts"/>

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
    Editor,
    Url,
    Simulator,
    Cli
}

export interface ShareEditorState {
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
            visible: false
        }
    }

    hide() {
        this.setState({ visible: false });
    }

    show(header: Header) {
        this.setState({ visible: true, mode: ShareMode.Screenshot, pubCurrent: header.pubCurrent });
    }

    shouldComponentUpdate(nextProps: ISettingsProps, nextState: ShareEditorState, nextContext: any): boolean {
        return this.state.visible != nextState.visible
            || this.state.mode != nextState.mode
            || this.state.pubCurrent != nextState.pubCurrent
            || this.state.screenshotId != nextState.screenshotId
            || this.state.currentPubId != nextState.currentPubId;
    }

    renderCore() {
        if (!this.state.visible) return null;

        const cloud = pxt.appTarget.cloud || {};
        const publishingEnabled = cloud.publishing || false;
        const header = this.props.parent.state.header;

        let ready = false;
        let mode = this.state.mode;
        let url = '';
        let embed = '';
        let help = lf("Copy this HTML to your website or blog.");
        let helpUrl = "/share";

        if (header) {
            if (!header.pubCurrent && !publishingEnabled) {
                this.props.parent.exportAsync()
                    .then(filedata => {
                        header.pubCurrent = true;
                        this.setState({ pubCurrent: true, currentPubId: filedata, screenshotId: undefined })
                    });
            }

            let rootUrl = pxt.appTarget.appTheme.embedUrl
            if (!/\/$/.test(rootUrl)) rootUrl += '/';

            const isBlocks = this.props.parent.getPreferredEditor() == pxt.BLOCKS_PROJECT_NAME;
            const pubCurrent = header ? header.pubCurrent : false;
            let currentPubId = (header ? header.pubId : undefined) || this.state.currentPubId;

            ready = (!!currentPubId && header.pubCurrent);
            if (ready) {
                url = `${rootUrl}${header.pubId}`;
                let editUrl = `${rootUrl}#${publishingEnabled ? 'pub' : 'project'}:${currentPubId}`;
                switch (mode) {
                    case ShareMode.Cli:
                        embed = `pxt extract ${header.pubId}`;
                        help = lf("Run this command from a shell.");
                        helpUrl = "/cli";
                        break;
                    case ShareMode.Simulator:
                        let padding = '81.97%';
                        // TODO: parts aspect ratio
                        if (pxt.appTarget.simulator) padding = (100 / pxt.appTarget.simulator.aspectRatio).toPrecision(4) + '%';
                        embed = pxt.docs.runUrl(pxt.webConfig.runUrl || rootUrl + "--run", padding, header.pubId);
                        break;
                    case ShareMode.Editor:
                        embed = pxt.docs.embedUrl(rootUrl, publishingEnabled ? 'sandbox' : 'sandboxproject', currentPubId, header.meta.blocksHeight);
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
            this.props.parent.publishAsync().done(() => {
                this.setState({ pubCurrent: true });
            });
        }
        const formState = !ready ? 'warning' : this.props.parent.state.publishing ? 'loading' : 'success';

        return <sui.Modal visible={this.state.visible} addClass="small searchdialog" header={lf("Embed Project") }
            onHide={() => this.setState({ visible: false }) }>
            <div className={`ui ${formState} form`}>
                { publishingEnabled ?
                    <div className="ui warning message">
                        <div className="header">{lf("Almost there!") }</div>
                        <p>{lf("You need to publish your project to share it or embed it in other web pages.") +
                            lf("You acknowledge having consent to publish this project.") }</p>
                        <sui.Button class={"green " + (this.props.parent.state.publishing ? "loading" : "") } text={lf("Publish project") } onClick={publish} />
                    </div> : undefined }
                { url && publishingEnabled ? <div className="ui success message">
                    <h3>{lf("Project URL") }</h3>
                    <div className="header"><a target="_blank" href={url}>{url}</a></div>
                </div> : undefined }
                { !ready && !publishingEnabled ? <div className="ui warning message">
                    <h3>{lf("Loading...") }</h3>
                </div> : undefined }
                { ready ?
                    <div className="ui form">
                        <div className="inline fields">
                            <label>{lf("Embed...") }</label>
                            {[
                                { mode: ShareMode.Screenshot, label: lf("Screenshot") },
                                { mode: ShareMode.Editor, label: lf("Editor") }]
                                .concat(
                                !publishingEnabled ? [
                                    { mode: ShareMode.Url, label: lf("Link") }
                                ] : []
                                )
                                .concat(
                                publishingEnabled ? [
                                    { mode: ShareMode.Simulator, label: lf("Simulator") },
                                    { mode: ShareMode.Cli, label: lf("Command line") }
                                ] : []
                                )
                                .map(f =>
                                    <div key={f.mode.toString() } className="field">
                                        <div className="ui radio checkbox">
                                            <input type="radio" checked={mode == f.mode} onChange={() => this.setState({ mode: f.mode }) }/>
                                            <label>{f.label}</label>
                                        </div>
                                    </div>
                                ) }
                        </div>
                    </div> : undefined }
                { ready ?
                    <sui.Field>
                        <p>{help} <span><a target="_blank" href={helpUrl}>{lf("Help...") }</a></span></p>
                        <sui.Input class="mini" readOnly={true} lines={4} value={embed} copy={ready} disabled={!ready} />
                    </sui.Field> : null }
            </div>
        </sui.Modal>
    }
}
