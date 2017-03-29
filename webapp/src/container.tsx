/// <reference path="../../typings/globals/react/index.d.ts" />
/// <reference path="../../typings/globals/react-dom/index.d.ts" />
/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as data from "./data";
import * as sui from "./sui";

type ISettingsProps = pxt.editor.ISettingsProps;


export class DocsMenuItem extends data.Component<ISettingsProps, {}> {
    constructor(props: ISettingsProps) {
        super(props);
    }

    openTutorial(path: string) {
        pxt.tickEvent(`docstutorial`, { path });
        this.props.parent.startTutorial(path);
    }

    render() {
        const targetTheme = pxt.appTarget.appTheme;
        return <sui.DropdownMenuItem icon="help circle large" class="help-dropdown-menuitem" textClass={"landscape only"} title={lf("Reference, lessons, ...") }>
            {targetTheme.docMenu.map(m =>
               !m.tutorial ? <a href={m.path} target="docs" key={"docsmenu" + m.path} role="menuitem" title={m.name} className="ui item">{m.name}</a>
                : <sui.Item key={"docsmenututorial" + m.path} role="menuitem" text={m.name} class="" onClick={() => this.openTutorial(m.path) } />
                ) }
        </sui.DropdownMenuItem>
    }
}

export class SideDocs extends data.Component<ISettingsProps, {}> {
    public static notify(message: pxsim.SimulatorMessage) {
        let sd = document.getElementById("sidedocs") as HTMLIFrameElement;
        if (sd && sd.contentWindow) sd.contentWindow.postMessage(message, "*");
    }

    constructor(props: ISettingsProps) {
        super(props);
    }

    setPath(path: string) {
        const docsUrl = pxt.webConfig.docsUrl || '/--docs';
        const mode = this.props.parent.isBlocksEditor() ? "blocks" : "js";
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
        let el = document.getElementById("sidedocs") as HTMLIFrameElement;
        if (el) el.src = url;
        else this.props.parent.setState({ sideDocsLoadUrl: url });
        this.props.parent.setState({ sideDocsCollapsed: false });
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
    }

    componentDidUpdate() {
        this.props.parent.editor.resize();
    }

    renderCore() {
        const state = this.props.parent.state;
        const docsUrl = state.sideDocsLoadUrl;
        if (!docsUrl) return null;

        const icon = !docsUrl || state.sideDocsCollapsed ? "expand" : "compress";
        return <div>
            <iframe id="sidedocs" src={docsUrl} role="complementary" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
            <button id="sidedocspopout" role="button" title={lf("Open documentation in new tab") } className={`circular ui icon button ${state.sideDocsCollapsed ? "hidden" : ""}`} onClick={() => this.popOut() }>
                <i className={`external icon`}></i>
            </button>
            <button id="sidedocsexpand" role="button" title={lf("Show/Hide side documentation") } className="circular ui icon button" onClick={() => this.toggleVisibility() }>
                <i className={`${icon} icon`}></i>
            </button>
        </div>
    }
}