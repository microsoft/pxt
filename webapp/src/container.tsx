/// <reference path="../../typings/globals/react/index.d.ts" />
/// <reference path="../../typings/globals/react-dom/index.d.ts" />
/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as data from "./data";
import * as sui from "./sui";
import * as core from "./core";

type ISettingsProps = pxt.editor.ISettingsProps;

// common menu items -- do not remove
// lf("About")
// lf("Getting started")
// lf("Buy")
// lf("Blocks")
// lf("JavaScript")
// lf("Examples")
// lf("Tutorials")
// lf("Projects")
// lf("Reference")
// lf("Support")
// lf("Hardware")

function openTutorial(parent: pxt.editor.IProjectView, path: string) {
    pxt.tickEvent(`docs`, { path }, { interactiveConsent: true });
    parent.setSideDoc(path);
}

function openDocs(parent: pxt.editor.IProjectView, path: string) {
    pxt.tickEvent(`docs`, { path }, { interactiveConsent: true });
    parent.setSideDoc(path);
}

export function renderDocItems(parent: pxt.editor.IProjectView, cls: string) {
    const targetTheme = pxt.appTarget.appTheme;
    return targetTheme.docMenu.map(m =>
        m.tutorial ? <sui.Item key={"docsmenututorial" + m.path} role="menuitem" ariaLabel={m.name} text={Util.rlf(m.name)} class={"ui " + cls} onClick={() => openTutorial(parent, m.path)} />
            : !/^\//.test(m.path) ? <a key={"docsmenulink" + m.path} role="menuitem" aria-label={m.name} title={m.name} className={`ui item link ${cls}`} href={m.path} target="docs">{Util.rlf(m.name)}</a>
                : <sui.Item key={"docsmenu" + m.path} role="menuitem" ariaLabel={m.name} text={Util.rlf(m.name)} class={"ui " + cls} onClick={() => openDocs(parent, m.path)} />
    );
}

export class DocsMenuItem extends data.Component<ISettingsProps, {}> {
    constructor(props: ISettingsProps) {
        super(props);
    }

    shouldComponentUpdate(nextProps: ISettingsProps, nextState: any, nextContext: any): boolean {
        return false;
    }

    render() {
        return <sui.DropdownMenuItem icon="help circle large" class="ui mobile hide help-dropdown-menuitem" textClass={"landscape only"} title={lf("Help")}>
            {renderDocItems(this.props.parent, "")}
        </sui.DropdownMenuItem>
    }
}

export class SideDocs extends data.Component<ISettingsProps, {}> {
    private firstLoad = true;
    private openingSideDoc = false;

    public static notify(message: pxsim.SimulatorMessage) {
        let sd = document.getElementById("sidedocsframe") as HTMLIFrameElement;
        if (sd && sd.contentWindow) sd.contentWindow.postMessage(message, "*");
    }

    constructor(props: ISettingsProps) {
        super(props);
    }

    setPath(path: string, blocksEditor: boolean) {
        this.openingSideDoc = true;
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
        else this.props.parent.setState({ sideDocsLoadUrl: url, sideDocsCollapsed: false });
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

        let sidedocstoggle = document.getElementById("sidedocstoggle");
        if (this.openingSideDoc && sidedocstoggle) {
            sidedocstoggle.focus();
            this.openingSideDoc = false;
        }
    }

    renderCore() {
        const state = this.props.parent.state;
        const docsUrl = state.sideDocsLoadUrl;
        if (!docsUrl) return null;

        return <div>
            <button id="sidedocstoggle" role="button" aria-label={state.sideDocsCollapsed ? lf("Expand the side documentation") : lf("Collapse the side documentation")} className="ui icon button" onClick={() => this.toggleVisibility() }>
                <i className={`icon large inverted ${state.sideDocsCollapsed ? 'book' : 'chevron right'}`}></i>
                {state.sideDocsCollapsed ? <i className={`icon large inverted chevron left hover`}></i> : undefined }
            </button>
            <div id="sidedocs">
                <div id="sidedocsframe-wrapper">
                    <iframe id="sidedocsframe" src={docsUrl} title={lf("Documentation")} aria-atomic="true" aria-live="assertive" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
                </div>
                <div id="sidedocsbar">
                    <a className="ui icon link" role="link" tabIndex={0} data-content={lf("Open documentation in new tab") } aria-label={lf("Open documentation in new tab") } onClick={() => this.popOut() } onKeyDown={sui.fireClickOnEnter} >
                        <i className="external icon"></i>
                    </a>
                </div>
            </div>
        </div>
    }
}
