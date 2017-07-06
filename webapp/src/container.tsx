/// <reference path="../../typings/globals/react/index.d.ts" />
/// <reference path="../../typings/globals/react-dom/index.d.ts" />
/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as data from "./data";
import * as sui from "./sui";
import * as core from "./core";

type ISettingsProps = pxt.editor.ISettingsProps;


export class DocsMenuItem extends data.Component<ISettingsProps, {}> {
    constructor(props: ISettingsProps) {
        super(props);
    }

    openTutorial(path: string) {
        pxt.tickEvent(`docstutorial`, { path });
        this.props.parent.startTutorial(path);
    }

    openDocs(path: string) {
        pxt.tickEvent(`docs`, { path });
        this.props.parent.setSideDoc(path);
    }

    render() {
        const targetTheme = pxt.appTarget.appTheme;
        return <sui.DropdownMenuItem icon="help circle large" class="help-dropdown-menuitem" textClass={"landscape only"} title={lf("Reference, lessons, ...") }>
            {targetTheme.docMenu.map(m =>
                !/^\//.test(m.path) ? <a key={"docsmenulink" + m.path} role="menuitem" className="ui item link" href={m.path} target="docs" tabIndex={-1}>{m.name}</a>
                : !m.tutorial ? <sui.Item key={"docsmenu" + m.path} role="menuitem" text={m.name} class="" onClick={() => this.openDocs(m.path) } tabIndex={-1}/>
                : <sui.Item key={"docsmenututorial" + m.path} role="menuitem" text={m.name} class="" onClick={() => this.openTutorial(m.path) } tabIndex={-1}/>
            ) }
        </sui.DropdownMenuItem>
    }
}

export class SideDocs extends data.Component<ISettingsProps, {}> {
    private rootNode: Element;
    private firstLoad = true;
    public static notify(message: pxsim.SimulatorMessage) {
        let sd = document.getElementById("sidedocsframe") as HTMLIFrameElement;
        if (sd && sd.contentWindow) sd.contentWindow.postMessage(message, "*");
    }

    constructor(props: ISettingsProps) {
        super(props);
    }

    setPath(path: string, blocksEditor: boolean) {
        const docsUrl = pxt.webConfig.docsUrl || '/--docs';
        const mode = blocksEditor ? "blocks" : "js";
        const url = `${docsUrl}#doc:${path}:${mode}:${pxt.Util.localeInfo()}`;
        this.setUrl(url);
    }

    setMarkdown(md: string) {
        const docsUrl = pxt.webConfig.docsUrl || '/--docs';
        const mode = this.props.parent.isBlocksEditor() ? "blocks" : "js";
        const url = `${docsUrl}#md:${encodeURIComponent(md)}:${mode}:${pxt.Util.localeInfo()}`;
        this.setUrl(url);
    }

    private setUrl(url: string) {
        let el = document.getElementById("sidedocsframe") as HTMLIFrameElement;
        if (el) el.src = url;
        else this.props.parent.setState({ sideDocsLoadUrl: url });
        let sideDocsCollapsed = this.firstLoad && (pxt.BrowserUtils.isMobile() || pxt.options.light);
        this.props.parent.setState({ sideDocsCollapsed: sideDocsCollapsed });
        this.firstLoad = false;
    }

    private handleEscape = (e: KeyboardEvent) => {
        let charCode = (typeof e.which == "number") ? e.which : e.keyCode
        if (charCode !== 27) {
            return;
        }

        e.preventDefault();
        this.toggleVisibility();
    }

    collapse() {
        this.props.parent.setState({ sideDocsCollapsed: true });
    }

    popOut() {
        SideDocs.notify({
            type: "popout"
        })
    }

    toggleVisibility() {
        const state = this.props.parent.state;
        this.props.parent.setState({ sideDocsCollapsed: !state.sideDocsCollapsed });
        document.getElementById("sidedocstoggle").focus();
    }

    componentDidUpdate() {
        this.props.parent.editor.resize();

        if (!this.props.parent.state.sideDocsCollapsed) {
            this.rootNode = ReactDOM.findDOMNode(this);
            if (this.rootNode !== null) {
                core.initializeFocusTabIndex(this.rootNode);
                this.mountSideDocs();
            }
        }
        else {
            this.unmountSideDocs();
        }
    }

    componentWillUnmount() {
        this.unmountSideDocs();
    }

    mountSideDocs = () => {
        (document.getElementById("sidedocsframe") as HTMLIFrameElement).contentWindow.document.addEventListener('keydown', this.handleEscape, true)
        document.addEventListener('keydown', this.handleEscape, true)
    }

    unmountSideDocs = () => {
        (document.activeElement as HTMLElement).blur();
        core.initializeFocusTabIndex(this.rootNode);
        this.rootNode = null;
        document.removeEventListener('keydown', this.handleEscape, true);
        (document.getElementById("sidedocsframe") as HTMLIFrameElement).contentWindow.document.removeEventListener('keydown', this.handleEscape, true);
    }

    renderCore() {
        const state = this.props.parent.state;
        const docsUrl = state.sideDocsLoadUrl;
        if (!docsUrl) return null;

        return <div>
            <button id="sidedocstoggle" role="button" className="firstFocused ui icon button" onClick={() => this.toggleVisibility() }>
                <i className={`icon large inverted ${state.sideDocsCollapsed ? 'book' : 'chevron right'}`}></i>
                {state.sideDocsCollapsed ? <i className={`icon large inverted chevron left hover`}></i> : undefined }
            </button>
            <div id="sidedocs">
                <div id="sidedocsbar">
                    <h3><a className="ui icon link" data-content={lf("Open documentation in new tab") } title={lf("Open documentation in new tab") } onClick={() => this.popOut() } tabIndex={9999} >
                        <i className="external icon"></i>
                    </a></h3>
                </div>
                <iframe id="sidedocsframe" src={docsUrl} role="complementary" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
            </div>
        </div>
    }
}