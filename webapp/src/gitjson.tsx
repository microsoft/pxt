import * as React from "react"
import * as pkg from "./package"
import * as core from "./core"
import * as srceditor from "./srceditor"
import * as sui from "./sui"
import * as data from "./data";
import * as workspace from "./workspace";

import Util = pxt.Util

export class Editor extends srceditor.Editor {
    private bump = false;
    private needsCommit = false;

    constructor(public parent: pxt.editor.IProjectView) {
        super(parent)
        this.goBack = this.goBack.bind(this);
        this.handleCommitClick = this.handleCommitClick.bind(this);
        this.handlePullClick = this.handlePullClick.bind(this);
        this.setBump = this.setBump.bind(this);
    }

    getId() {
        return "githubEditor"
    }

    hasHistory() { return false; }

    hasEditorToolbar() {
        return false
    }

    setVisible(b: boolean) {
        this.isVisible = b
    }

    setHighContrast(hc: boolean) {
    }

    acceptsFile(file: pkg.File) {
        return file.name === pxt.github.GIT_JSON;
    }

    private setBump(v: boolean) {
        this.bump = !!v;
    }

    private goBack() {
        pxt.tickEvent("github.backButton", undefined, { interactiveConsent: true })
        this.parent.openPreviousEditor()
    }

    private handleCommitClick(e: React.MouseEvent<HTMLElement>) {
        this.parent.pushPullAsync();
    }

    private handlePullClick(e: React.MouseEvent<HTMLElement>) {
        this.pullAsync().done();
    }

    async pullAsync() {
        core.showLoading("loadingheader", lf("syncing with github..."));
        try {
            let status = await workspace.pullAsync(this.parent.state.header)
                .catch(core.handleNetworkError)
            switch (status) {
                case workspace.PullStatus.NoSourceControl:
                case workspace.PullStatus.UpToDate:
                    break
                case workspace.PullStatus.NeedsCommit:
                    this.needsCommit = true;
                    break
                case workspace.PullStatus.GotChanges:
                    await this.parent.reloadHeaderAsync()
                    break
            }
        } finally {
            core.hideLoading("loadingheader")
        }
    }

    display() {
        const header = this.parent.state.header;
        if (!header) return undefined;
        this.needsCommit = true; // todo remove

        const githubId = pxt.github.parseRepoId(header.githubId);
        return (
            <div id="serialArea">
                <div id="serialHeader" className="ui serialHeader">
                    <div className="leftHeaderWrapper">
                        <div className="leftHeader">
                            <sui.Button title={lf("Go back")} icon="arrow left" text={lf("Go back")} textClass="landscape only" tabIndex={0} onClick={this.goBack} onKeyDown={sui.fireClickOnEnter} />
                        </div>
                    </div>
                    <div className="rightHeader">
                        <sui.Button className="ui icon button" icon="down arrow" text={lf("Pull changes")} textClass={lf("landscape only")} title={lf("Pull changes")} onClick={this.handlePullClick} onKeyDown={sui.fireClickOnEnter} />
                    </div>
                </div>
                {this.needsCommit ? <div className="ui warning message">
                    <i className="down arrow icon"></i>
                    <div className="content">
                        {lf("You need to commit your changes in order to pull changes from GitHub.")}
                    </div>
                </div> : undefined}
                <div className="ui form">
                    <h4 className="header">
                        <i className="large github icon" />
                        {githubId.fullName}#{githubId.tag}
                    </h4>
                    <div className="ui field">
                        <input type="url" tabIndex={0} autoFocus placeholder={lf("Updates to the code.")} className="ui blue fluid"></input>
                    </div>
                    <div className="ui field">
                        <sui.PlainCheckbox
                            label={lf("Publish to users (increment version)")}
                            onChange={this.setBump} />
                    </div>
                    <div className="ui field">
                        <sui.Button className="primary" text={lf("Commit changes")} onClick={this.handleCommitClick} onKeyDown={sui.fireClickOnEnter} />
                    </div>
                </div>
            </div>
        )
    }
}
