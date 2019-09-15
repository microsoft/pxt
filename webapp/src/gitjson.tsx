import * as React from "react"
import * as pkg from "./package"
import * as core from "./core"
import * as srceditor from "./srceditor"
import * as sui from "./sui"
import * as workspace from "./workspace";
import * as dialogs from "./dialogs";

interface DiffCache {
    gitFile: string;
    editorFile: string;
    diff: JSX.Element;
    revert: () => void;
}

export class Editor extends srceditor.Editor {
    private description: string = undefined;
    private needsCommitMessage = false;
    private diffCache: pxt.Map<DiffCache> = {};
    private needsPull: boolean = null;
    private pullOK = false;

    constructor(public parent: pxt.editor.IProjectView) {
        super(parent)
        this.goBack = this.goBack.bind(this);
        this.handleCommitClick = this.handleCommitClick.bind(this);
        this.handlePullClick = this.handlePullClick.bind(this);
        this.handleDescriptionChange = this.handleDescriptionChange.bind(this);
        this.handleBumpClick = this.handleBumpClick.bind(this);
        this.handleBranchClick = this.handleBranchClick.bind(this);
        this.handleGithubError = this.handleGithubError.bind(this);
    }

    getId() {
        return "githubEditor"
    }

    getCurrentSource(): string {
        // modifications are done on the EditorFile object, so make sure
        // we don't store some cached data in this.currSource
        const f = pkg.mainEditorPkg().files[pxt.github.GIT_JSON]
        return f.content
    }

    hasHistory() { return false; }

    hasEditorToolbar() {
        return false
    }

    setVisible(b: boolean) {
        this.isVisible = b;
        if (!b) {
            this.needsCommitMessage = false;
            this.diffCache = {}
            this.needsPull = null;
            this.pullOK = false;
        }
    }

    setHighContrast(hc: boolean) {
    }

    acceptsFile(file: pkg.File) {
        return file.name === pxt.github.GIT_JSON;
    }

    private async saveGitJsonAsync(gs: pxt.github.GitJson) {
        const f = pkg.mainEditorPkg().files[pxt.github.GIT_JSON]
        await f.setContentAsync(JSON.stringify(gs, null, 4))
    }

    private async switchToBranchAsync(newBranch: string) {
        const header = this.parent.state.header;
        const gs = this.getGitJson();
        const parsed = this.parsedRepoId()
        header.githubId = parsed.fullName + "#" + newBranch
        gs.repo = header.githubId
        await this.saveGitJsonAsync(gs)
    }

    private async switchBranchAsync() {
        const gid = this.parsedRepoId()
        const branches = await pxt.github.listRefsExtAsync(gid.fullName, "heads")
        const branchList = Object.keys(branches.refs).map(r => ({
            name: r,
            sha: branches.refs[r],
            onClick: async () => {
                core.hideDialog()
                this.needsCommitMessage = false
                const prevBranch = this.parsedRepoId().tag
                try {
                    await this.switchToBranchAsync(r)
                    await this.pullAsync()
                    this.parent.setState({});
                } finally {
                    if (this.needsCommitMessage) {
                        console.log("going back to " + prevBranch)
                        await this.switchToBranchAsync(prevBranch)
                    }
                }
            }
        }))

        await core.confirmAsync({
            header: lf("Switch to a different branch"),
            hideAgree: true,
            /* tslint:disable:react-a11y-anchors */
            jsx: <div className="ui form">
                <div className="ui relaxed divided list" role="menu">
                    {branchList.map(r =>
                        <div key={r.name} className="item">
                            <i className="large github middle aligned icon"></i>
                            <div className="content">
                                <a onClick={r.onClick} role="menuitem" className="header">{r.name}</a>
                                <div className="description">
                                    {r.sha}
                                </div>
                            </div>
                        </div>)}
                </div>
            </div>,
        })
    }

    private handleBumpClick(e: React.MouseEvent<HTMLElement>) {
        pxt.tickEvent("github.bump");
        e.stopPropagation();
        this.bumpAsync().done();
    }

    private handleBranchClick(e: React.MouseEvent<HTMLElement>) {
        pxt.tickEvent("github.branch");
        e.stopPropagation();
        this.switchBranchAsync().done();
    }

    private goBack() {
        pxt.tickEvent("github.backButton", undefined, { interactiveConsent: true })
        this.parent.openPreviousEditor()
    }

    private async handleCommitClick(e: React.MouseEvent<HTMLElement>) {
        pxt.tickEvent("github.commit");
        this.needsCommitMessage = false;
        await this.commitAsync();
        this.goBack();
    }

    private handlePullClick(e: React.MouseEvent<HTMLElement>) {
        pxt.tickEvent("github.pull");
        this.pullAsync().done();
    }

    private handleDescriptionChange(v: string) {
        this.description = v;
    }

    private handleGithubError(e: any) {
        pxt.reportException(e);
        const statusCode = parseInt(e.statusCode);
        if (e.isOffline || statusCode === 0)
            core.warningNotification(lf("Please connect to internet and try again."));
        else if (statusCode == 401)
            core.warningNotification(lf("GitHub access token looks invalid; logout and try again."));
        else if (this.pullOK && e.needsWritePermission)
            core.warningNotification(lf("You don't have write permission (or your token is missing 'repo' scope)."));
        else
            core.warningNotification(lf("Oops, something went wrong. Please try again."))
    }

    private async bumpAsync() {
        const newVer = await core.promptAsync({
            header: lf("Release version?"),
            body: lf("Please specify version for your new release. You can leave it at default."),
            initialValue: workspace.bumpedVersion(pkg.mainPkg.config),
            agreeLbl: lf("Create release"),
            disagreeLbl: lf("Cancel")
        })

        if (!newVer)
            return

        if (!pxt.semver.tryParse(newVer)) {
            core.warningNotification(lf("Invalid version number"))
            return
        }

        core.showLoading("bumpheader", lf("creating release..."));
        try {
            const header = this.parent.state.header;
            await workspace.bumpAsync(header)
            await this.parent.reloadHeaderAsync();
            core.hideLoading("bumpheader");
            core.infoNotification(lf("GitHub release created."))
        } catch (e) {
            this.handleGithubError(e);
        } finally {
            core.hideLoading("bumpheader");
        }
    }

    private async pullAsync() {
        core.showLoading("loadingheader", lf("pulling changes..."));
        try {
            let status = await workspace.pullAsync(this.parent.state.header)
                .catch(this.handleGithubError)
            switch (status) {
                case workspace.PullStatus.NoSourceControl:
                case workspace.PullStatus.UpToDate:
                    break
                case workspace.PullStatus.NeedsCommit:
                    this.needsCommitMessage = true;
                    this.parent.setState({});
                    break
                case workspace.PullStatus.GotChanges:
                    await this.parent.reloadHeaderAsync()
                    break
            }
        } catch (e) {
            this.handleGithubError(e);
        } finally {
            core.hideLoading("loadingheader")
        }
    }

    private getGitJson(): pxt.github.GitJson {
        const gitJsonText = pkg.mainEditorPkg().getAllFiles()[pxt.github.GIT_JSON]
        const gitJson = JSON.parse(gitJsonText || "{}") as pxt.github.GitJson
        return gitJson;
    }

    private parsedRepoId() {
        const header = this.parent.state.header;
        return pxt.github.parseRepoId(header.githubId);
    }

    private async pullRequestAsync() {
        try {
            core.showLoading("loadingheader", lf("creating pull request..."));
            // create a new PR branch
            const header = this.parent.state.header;
            const parsed = this.parsedRepoId()
            let gs = this.getGitJson();
            const commitId = gs.commit.sha;
            const baseBranch = parsed.tag
            const newBranch = await pxt.github.createNewPrBranchAsync(parsed.fullName, commitId)

            await this.switchToBranchAsync(newBranch)

            const msg = this.description || lf("Updates")
            await this.commitCoreAsync(); // commit current changes into the new branch
            const prUrl = await pxt.github.createPRFromBranchAsync(parsed.fullName, baseBranch, newBranch, msg);

            gs = this.getGitJson()
            gs.prUrl = prUrl
            await this.saveGitJsonAsync(gs)
            await this.parent.reloadHeaderAsync()
        } catch (e) {
            this.handleGithubError(e)
        } finally {
            core.hideLoading("loadingheader")
        }
    }

    private async commitCoreAsync() {
        const repo = this.parent.state.header.githubId;
        const header = this.parent.state.header;
        const msg = this.description || lf("Updates")
        let commitId = await workspace.commitAsync(header, msg)
        if (commitId) {
            // merge failure; do a PR
            // we could ask the user, but it's unlikely they can do anything else to fix it
            let prInfo = await workspace.prAsync(header, commitId, msg)
            await dialogs.showPRDialogAsync(repo, prInfo.url)
            // when the dialog finishes, we pull again - it's possible the user
            // has resolved the conflict in the meantime
            await workspace.pullAsync(header)
            // skip bump in this case - we don't know if it was merged
        }
        this.description = ""
    }

    private async commitAsync() {
        core.showLoading("loadingheader", lf("commit and push..."));
        try {
            await this.commitCoreAsync()
            await this.parent.reloadHeaderAsync()
        } catch (e) {
            this.handleGithubError(e);
        } finally {
            core.hideLoading("loadingheader")
        }
    }

    private showDiff(f: pkg.File) {
        let cache = this.diffCache[f.name]
        if (!cache) {
            cache = {} as any
            this.diffCache[f.name] = cache
        }
        if (cache.gitFile == f.baseGitContent && cache.editorFile == f.content)
            return cache.diff

        const isBlocks = /\.blocks$/.test(f.name)
        const classes: pxt.Map<string> = {
            "@": "diff-marker",
            " ": "diff-unchanged",
            "+": "diff-added",
            "-": "diff-removed",
        }
        const diffLines = pxt.github.diff(f.baseGitContent, f.content, { ignoreWhitespace: true })
        let lnA = 0, lnB = 0
        const diffJSX = isBlocks ? [] : diffLines.map(ln => {
            const m = /^@@ -(\d+),\d+ \+(\d+),\d+/.exec(ln)
            if (m) {
                lnA = parseInt(m[1]) - 1
                lnB = parseInt(m[2]) - 1
            } else {
                if (ln[0] != "+")
                    lnA++
                if (ln[0] != "-")
                    lnB++
            }
            return (
                <tr key={lnA + lnB} className={classes[ln[0]]}>
                    <td className="line-a" data-content={lnA}></td>
                    <td className="line-b" data-content={lnB}></td>
                    {ln[0] == "@"
                        ? <td colSpan={2} className="change"><pre>{ln}</pre></td>
                        : <td className="marker" data-content={ln[0]}></td>
                    }
                    {ln[0] == "@"
                        ? undefined
                        : <td className="change"><pre>{ln.slice(2)}</pre></td>
                    }
                </tr>)
        })

        cache.gitFile = f.baseGitContent
        cache.editorFile = f.content
        cache.revert = () => {
            core.confirmAsync({
                header: lf("Would you like to revert changes to {0}?", f.name),
                body: lf("Changes will be lost for good. No undo."),
                agreeLbl: lf("Revert"),
                agreeClass: "red",
                agreeIcon: "trash",
            }).then(res => {
                if (res) {
                    f.setContentAsync(f.baseGitContent)
                        .then(() => {
                            // force refresh of ourselves
                            this.parent.setState({})
                        })
                }
            }).done()
        }

        cache.diff = (
            <div key={f.name} className="ui segments filediff">
                <div className="ui segment diffheader">
                    <span>{f.name}</span>
                    <sui.Button className="small" icon="undo" text={lf("Revert")} ariaLabel={lf("Revert file")} title={lf("Revert file")} textClass={"landscape only"} onClick={cache.revert} />
                </div>
                {isBlocks ? <div className="ui segment"><p>{lf("Some blocks changed")}</p></div> : diffJSX.length ?
                    <div className="ui segment diff">
                        <table className="diffview">
                            <tbody>
                                {diffJSX}
                            </tbody>
                        </table>
                    </div>
                    :
                    <div className="ui segment">
                        <p>{lf("Whitespace changes only.")}</p>
                    </div>
                }
            </div>)
        return cache.diff
    }


    display() {
        if (!this.isVisible)
            return undefined;

        const header = this.parent.state.header;
        if (!header || !header.githubId) return undefined;
        // TODO: disable commit changes if no changes available
        // TODO: commitAsync handle missing token or failed push

        const diffFiles = pkg.mainEditorPkg().sortedFiles().filter(p => p.baseGitContent != null && p.baseGitContent != p.content)
        const needsCommit = diffFiles.length > 0

        if (this.needsPull == null) {
            this.needsPull = true
            workspace.hasPullAsync(this.parent.state.header)
                .then(v => {
                    this.pullOK = true
                    if (v != this.needsPull) {
                        this.needsPull = v
                        this.parent.setState({})
                    }
                })
                .catch(this.handleGithubError)
        }

        /**
         *                                     <sui.PlainCheckbox
                                        label={lf("Publish to users (increment version)")}
                                        onChange={this.setBump} />
    
         */
        const githubId = this.parsedRepoId()
        const master = githubId.tag == "master";
        const gs = this.getGitJson();
        const url = gs.prUrl || `https://github.com/${githubId.fullName}${master ? "" : `/tree/${githubId.tag}`}`;
        return (
            <div id="githubArea">
                <div id="serialHeader" className="ui serialHeader">
                    <div className="leftHeaderWrapper">
                        <div className="leftHeader">
                            <sui.Button title={lf("Go back")} icon="arrow left" text={lf("Go back")} textClass="landscape only" tabIndex={0} onClick={this.goBack} onKeyDown={sui.fireClickOnEnter} />
                        </div>
                    </div>
                    <div className="rightHeader">
                        <sui.Button className="ui icon button" icon="down arrow"
                            text={this.needsPull ? lf("Pull changes") : lf("Up to date")} textClass={lf("landscape only")} title={lf("Pull changes")} onClick={this.handlePullClick} onKeyDown={sui.fireClickOnEnter} />
                    </div>
                </div>
                {this.needsCommitMessage ? <div className="ui warning message">
                    <div className="content">
                        {lf("You need to commit your changes in order to pull changes from GitHub.")}
                    </div>
                </div> : undefined}

                <div className="ui form">
                    <h4 className="header">
                        <a href={url} role="button" className="ui link" target="_blank" rel="noopener noreferrer">
                            <i className="large github icon" />
                        </a>
                        <span className="repo-name">{githubId.fullName}</span>
                        <span onClick={this.handleBranchClick} role="button" className="repo-branch">{"#" + githubId.tag}</span>
                    </h4>
                    {needsCommit ?
                        <div>
                            <div className="ui field">
                                <sui.Input type="url" placeholder={lf("Describe your changes.")} value={this.description} onChange={this.handleDescriptionChange} />
                            </div>
                            {<div className="field">
                                <p>{lf("Commit directly to the {0} branch.", githubId.tag || "master")}
                                    <sui.Link href="/github/commit" icon="help circle" target="_blank" role="button" title={lf("A commit is a snapshot of your code stored in GitHub.")} /></p>
                            </div>}
                            <div className="ui field">
                                <sui.Button className="primary" text={lf("Commit changes")} onClick={this.handleCommitClick} onKeyDown={sui.fireClickOnEnter} />
                            </div>
                        </div>
                        :
                        <div>
                            <p>{lf("No local changes found.")}</p>
                            {master ? <div className="ui divider"></div> : undefined}
                            {master ?
                                <div className="ui field">
                                    <p>
                                        {lf("Bump up the version number and create a release on GitHub.")}
                                        <sui.Link href="/github/release" icon="help circle" target="_blank" role="button" title={lf("Learn more about extension releases.")} />
                                    </p>
                                    <sui.Button className="primary" text={lf("Create release")} onClick={this.handleBumpClick} onKeyDown={sui.fireClickOnEnter} />
                                </div> : undefined}
                        </div>
                    }
                    <div className="ui">
                        {diffFiles.map(df => this.showDiff(df))}
                    </div>

                    {dialogs.githubFooter("", () => this.parent.setState({}))}
                </div>
            </div>
        )
    }
}
