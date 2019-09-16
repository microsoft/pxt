import * as React from "react"
import * as pkg from "./package"
import * as core from "./core"
import * as srceditor from "./srceditor"
import * as sui from "./sui"
import * as workspace from "./workspace";
import * as dialogs from "./dialogs";
import * as coretsx from "./coretsx";

interface DiffCache {
    gitFile: string;
    editorFile: string;
    diff: JSX.Element;
    revert: () => void;
}

export class Editor extends srceditor.Editor {
    private description: string = undefined;
    private needsCommitMessage = false;
    private needsLicenseMessage = false;
    private diffCache: pxt.Map<DiffCache> = {};
    private needsPull: boolean = null;
    private previousCfgKey = "";
    private triedFork = false;

    constructor(public parent: pxt.editor.IProjectView) {
        super(parent)
        this.goBack = this.goBack.bind(this);
        this.handleCommitClick = this.handleCommitClick.bind(this);
        this.handlePullClick = this.handlePullClick.bind(this);
        this.handleDescriptionChange = this.handleDescriptionChange.bind(this);
        this.handleBumpClick = this.handleBumpClick.bind(this);
        this.handleBranchClick = this.handleBranchClick.bind(this);
        this.handleGithubError = this.handleGithubError.bind(this);
        this.handleSignInClick = this.handleSignInClick.bind(this);
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

    private pkgConfigKey(cfgtxt: string) {
        const cfg = JSON.parse(cfgtxt) as pxt.PackageConfig
        delete cfg.version
        return JSON.stringify(cfg)
    }

    setVisible(b: boolean) {
        this.isVisible = b;
        if (b) {
            this.previousCfgKey = this.pkgConfigKey(pkg.mainEditorPkg().files[pxt.CONFIG_NAME].content)
        } else {
            this.needsCommitMessage = false;
            this.diffCache = {}
            this.needsPull = null;
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
        gs.prUrl = null
        await this.saveGitJsonAsync(gs)
    }

    private async newBranchAsync() {
        const gid = this.parsedRepoId()
        const initialBranchName = await pxt.github.getNewBranchNameAsync(gid.fullName, "patch-")
        const branchName = await core.promptAsync({
            header: lf("New branch name"),
            body: lf("Name cannot have spaces or special characters. Examples: {0}",
                "my_feature, add-colors, fix_something"),
            agreeLbl: lf("Create"),
            initialValue: initialBranchName
        })
        if (!branchName)
            return

        core.showLoading("branchheader", lf("creating branch..."));
        try {
            const gs = this.getGitJson()
            await pxt.github.createNewBranchAsync(gid.fullName, branchName, gs.commit.sha)
            await this.switchToBranchAsync(branchName)
            this.parent.setState({});
        } catch (e) {
            this.handleGithubError(e);
        } finally {
            core.hideLoading("branchheader")
        }
    }

    private async switchBranchAsync() {
        const gid = this.parsedRepoId()
        const branches = await pxt.github.listRefsExtAsync(gid.fullName, "heads")
        const branchList = Object.keys(branches.refs).map(r => ({
            name: r,
            description: branches.refs[r],
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
                        await this.switchToBranchAsync(prevBranch)
                    }
                }
            }
        }))

        branchList.unshift({
            name: lf("Create new branch"),
            description: lf("Based on {0}", gid.tag),
            onClick: () => {
                core.hideDialog()
                return this.newBranchAsync()
            }
        })

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
                                    {r.description}
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

    private handleSignInClick(e: React.MouseEvent<HTMLElement>) {
        pxt.tickEvent("github.signin");
        e.stopPropagation();
        dialogs.showGithubLoginAsync()
            .done(() => this.parent.setState({}));
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

    private async forkAsync(fromError: boolean) {
        const parsed = this.parsedRepoId()
        const pref = fromError ? lf("You don't seem to have write permission to {0}.\n", parsed.fullName) : ""
        const res = await core.confirmAsync({
            header: lf("Do you want to fork {0}?", parsed.fullName),
            body: pref +
                lf("Forking repo creates a copy under your account. You can later ask {0} to include your changes via a pull request.",
                    parsed.owner),
            agreeLbl: "Fork",
            agreeIcon: "copy outline"
        })
        if (!res)
            return

        core.showLoading("fork", lf("forking repo (this may take a minute or two)..."))
        try {
            const gs = this.getGitJson();
            const newGithubId = await pxt.github.forkRepoAsync(parsed.fullName, gs.commit.sha)
            const header = this.parent.state.header
            header.githubId = newGithubId
            gs.repo = header.githubId
            await this.saveGitJsonAsync(gs)
        } catch (e) {
            this.handleGithubError(e)
        } finally {
            core.hideLoading("fork")
        }
        this.parent.setState({})
    }

    private handleGithubError(e: any) {
        const statusCode = parseInt(e.statusCode);
        if (e.isOffline || statusCode === 0)
            core.warningNotification(lf("Please connect to internet and try again."));
        else if (statusCode == 401)
            core.warningNotification(lf("GitHub access token looks invalid; logout and try again."));
        else if (e.needsWritePermission) {
            if (this.triedFork) {
                core.warningNotification(lf("You don't have write permission."));
            } else {
                core.hideDialog()
                this.forkAsync(true).done()
            }
        } else {
            pxt.reportException(e);
            core.warningNotification(lf("Oops, something went wrong. Please try again."))
        }
    }

    private async bumpAsync() {
        const v = pxt.semver.parse(pkg.mainPkg.config.version || "0.0.0")
        const vmajor = pxt.semver.parse(pxt.semver.stringify(v)); vmajor.major++; vmajor.minor = 0; vmajor.patch = 0;
        const vminor = pxt.semver.parse(pxt.semver.stringify(v)); vminor.minor++; vminor.patch = 0;
        const vpatch = pxt.semver.parse(pxt.semver.stringify(v)); vpatch.patch++;

        let bumpType: string = "patch";
        function onBumpChange(e: React.ChangeEvent<HTMLInputElement>) {
            bumpType = e.currentTarget.name;
            coretsx.forceRender();
        }
        const ok = await core.confirmAsync({
            header: lf("Pick a release version"),
            agreeLbl: lf("Create release"),
            disagreeLbl: lf("Cancel"),
            jsxd: () => <div className="grouped fields">
                <label>{lf("Choose a release version that describes the changes you made to the code.")}
                    <sui.Link href="/github/semver" icon="help circle" target="_blank" role="button" title={lf("Learn about version numbers.")} />
                </label>
                <div className="field">
                    <div className="ui radio checkbox">
                        <input type="radio" name="patch" checked={bumpType == "patch"} aria-checked={bumpType == "patch"} onChange={onBumpChange} />
                        <label>{lf("{0}: patch (bug fixes or other non-user visible changes)", pxt.semver.stringify(vpatch))}</label>
                    </div>
                </div>
                <div className="field">
                    <div className="ui radio checkbox">
                        <input type="radio" name="minor" checked={bumpType == "minor"} aria-checked={bumpType == "minor"} onChange={onBumpChange} />
                        <label>{lf("{0}: minor change (added function or optional parameters)", pxt.semver.stringify(vminor))}</label>
                    </div>
                </div>
                <div className="field">
                    <div className="ui radio checkbox">
                        <input type="radio" name="major" checked={bumpType == "major"} aria-checked={bumpType == "major"} onChange={onBumpChange} />
                        <label>{lf("{0}: major change (renamed functions, deleted parameters or functions)", pxt.semver.stringify(vmajor))}</label>
                    </div>
                </div>
            </div>
        })

        if (!ok)
            return

        let newv = vpatch;
        if (bumpType == "major")
            newv = vmajor;
        else if (bumpType == "minor")
            newv = vminor;
        const newVer = pxt.semver.stringify(newv)
        core.showLoading("bumpheader", lf("creating release {0}...", newVer));
        try {
            const header = this.parent.state.header;
            await workspace.bumpAsync(header, newVer)
            await this.maybeReloadAsync()
            core.hideLoading("bumpheader");
            core.infoNotification(lf("GitHub release created."))
        } catch (e) {
            this.handleGithubError(e);
        } finally {
            core.hideLoading("bumpheader");
        }
    }

    private async maybeReloadAsync() {
        // here, the true state of files is stored in workspace
        const header = this.parent.state.header;
        const files = await workspace.getTextAsync(header.id);
        // save file content from workspace, so they won't get overridden
        pkg.mainEditorPkg().setFiles(files);
        // check if we need to reload header
        const newKey = this.pkgConfigKey(files[pxt.CONFIG_NAME])
        if (newKey == this.previousCfgKey) {
            return
        } else {
            this.previousCfgKey = newKey
            await this.parent.reloadHeaderAsync();
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
                    await this.maybeReloadAsync()
                    break
            }
        } catch (e) {
            this.handleGithubError(e);
        } finally {
            this.needsPull = null; // refresh pull state
            core.hideLoading("loadingheader")
            this.parent.setState({});
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

    /*
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
    */

    private async commitCoreAsync() {
        const repo = this.parent.state.header.githubId;
        const header = this.parent.state.header;
        const msg = this.description || lf("Updates")
        let commitId = await workspace.commitAsync(header, msg)
        if (commitId) {
            // merge failure; do a PR
            // we could ask the user, but it's unlikely they can do anything else to fix it
            let prUrl = await workspace.prAsync(header, commitId, msg)
            await dialogs.showPRDialogAsync(repo, prUrl)
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
            await this.maybeReloadAsync()
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
        const diffLines = pxt.github.diff(f.baseGitContent || "", f.content, { ignoreWhitespace: true })
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

        let deletedFiles: string[] = []
        let addedFiles: string[] = []
        if (f.name == pxt.CONFIG_NAME) {
            const oldCfg = pxt.allPkgFiles(JSON.parse(f.baseGitContent))
            const newCfg = pxt.allPkgFiles(JSON.parse(f.content))
            deletedFiles = oldCfg.filter(fn => newCfg.indexOf(fn) == -1)
            addedFiles = newCfg.filter(fn => oldCfg.indexOf(fn) == -1)
        }

        cache.gitFile = f.baseGitContent
        cache.editorFile = f.content
        cache.revert = async () => {
            const res = await core.confirmAsync({
                header: lf("Would you like to revert changes to {0}?", f.name),
                body: lf("Changes will be lost for good. No undo."),
                agreeLbl: lf("Revert"),
                agreeClass: "red",
                agreeIcon: "trash",
            })

            if (!res)
                return

            this.needsCommitMessage = false; // maybe we no longer do

            if (f.baseGitContent == null) {
                await pkg.mainEditorPkg().removeFileAsync(f.name)
                await this.parent.reloadHeaderAsync()
            } else if (f.name == pxt.CONFIG_NAME) {
                const gs = this.getGitJson()
                for (let d of deletedFiles) {
                    const prev = workspace.lookupFile(gs.commit, d)
                    pkg.mainEditorPkg().setFile(d, prev && prev.blobContent || "// Cannot restore.")
                }
                for (let d of addedFiles) {
                    delete pkg.mainEditorPkg().files[d]
                }
                await f.setContentAsync(f.baseGitContent)
                await this.parent.reloadHeaderAsync()
            } else {
                await f.setContentAsync(f.baseGitContent)
                // force refresh of ourselves
                this.parent.setState({})
            }
        }

        cache.diff = (
            <div key={f.name} className="ui segments filediff">
                <div className="ui segment diffheader">
                    <span>{f.name}</span>
                    <sui.Button className="small" icon="undo" text={lf("Revert")}
                        ariaLabel={lf("Revert file")} title={lf("Revert file")}
                        textClass={"landscape only"} onClick={cache.revert} />
                    {deletedFiles.length == 0 ? undefined :
                        <p>
                            {lf("Reverting this file will also restore:")}
                            {" "}
                            <span className="files-to-restore">{deletedFiles.join(", ")}</span>
                        </p>}
                    {addedFiles.length == 0 ? undefined :
                        <p>
                            {lf("Reverting this file will also remove:")}
                            {" "}
                            <span className="files-to-delete">{addedFiles.join(", ")}</span>
                        </p>}
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

        const diffFiles = pkg.mainEditorPkg().sortedFiles().filter(p => p.baseGitContent != p.content)
        const needsCommit = diffFiles.length > 0

        if (this.needsPull == null) {
            this.needsPull = true
            workspace.hasPullAsync(this.parent.state.header)
                .then(v => {
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
        // don't use gs.prUrl, as it gets cleared often
        const url = `https://github.com/${githubId.fullName}${master ? "" : `/tree/${githubId.tag}`}`;
        const needsToken = !pxt.github.token;
        // this will show existing PR if any
        const prUrl = !gs.isFork && master ? null :
            `https://github.com/${githubId.fullName}/compare/${githubId.tag}?expand=1`
        this.needsLicenseMessage = gs.commit && !gs.commit.tree.tree.some(f =>
            /^LICENSE/.test(f.path.toUpperCase()) || /^COPYING/.test(f.path.toUpperCase()))
        return (
            <div id="githubArea">
                <div id="serialHeader" className="ui serialHeader">
                    <div className="leftHeaderWrapper">
                        <div className="leftHeader">
                            <sui.Button title={lf("Go back")} icon="arrow left" text={lf("Go back")} textClass="landscape only" tabIndex={0} onClick={this.goBack} onKeyDown={sui.fireClickOnEnter} />
                        </div>
                    </div>
                    <div className="rightHeader">
                        <sui.Button icon={`${this.needsPull !== false ? "down arrow" : "check"} ${this.needsPull !== false ? "positive" : ""}`}
                            text={lf("Pull changes")} textClass={lf("landscape only")} title={lf("Pull changes from GitHub to get your code up-to-date.")} onClick={this.handlePullClick} onKeyDown={sui.fireClickOnEnter} />
                        {!needsToken ? <sui.Link className="ui button" icon="users" href={`https://github.com/${githubId.fullName}/settings/collaboration`} target="_blank" title={lf("Invite collaborators.")} onKeyDown={sui.fireClickOnEnter} /> : undefined}
                        <sui.Link className="ui button" icon="github" href={url} title={lf("Open repository in GitHub.")} target="_blank" onKeyDown={sui.fireClickOnEnter} />
                    </div>
                </div>
                {!pxt.github.token ? <div className="ui info message join">
                    <p>{lf("Host your code on GitHub and work together on projects.")}</p>
                    <sui.Button className="tiny green" text={lf("Sign in")} onClick={this.handleSignInClick} />
                </div> : undefined}
                {this.needsCommitMessage ? <div className="ui warning message">
                    <div className="content">
                        {lf("You need to commit your changes first, before you can pull from GitHub.")}
                    </div>
                </div> : undefined}
                {this.needsLicenseMessage ? <div className="ui warning message">
                    <div className="content">
                        {lf("Your project doesn't seem to have a license. This makes it hard for others to use it.")}
                        {" "}
                        <a href={`https://github.com/${githubId.fullName}/community/license/new?branch=${githubId.tag}`}
                            role="button" className="ui link create-pr"
                            target="_blank" rel="noopener noreferrer">
                            {lf("Add license")}
                        </a>
                    </div>
                </div> : undefined}

                <div className="ui form">
                    {!prUrl ? undefined :
                        <a href={prUrl} role="button" className="ui link create-pr"
                            target="_blank" rel="noopener noreferrer">
                            {lf("Pull request")}
                        </a>}
                    <h3 className="header">
                        <span className="repo-name">{githubId.fullName}</span>
                        <span onClick={this.handleBranchClick} role="button" className="repo-branch">{"#" + githubId.tag}</span>
                    </h3>
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
                                <sui.Button className="primary" text={lf("Commit changes")} disabled={needsToken} onClick={this.handleCommitClick} onKeyDown={sui.fireClickOnEnter} />
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
                                    <sui.Button className="primary" text={lf("Create release")} disabled={needsToken} onClick={this.handleBumpClick} onKeyDown={sui.fireClickOnEnter} />
                                </div> : undefined}
                        </div>
                    }
                    <div className="ui">
                        {diffFiles.map(df => this.showDiff(df))}
                    </div>

                    {pxt.github.token ? dialogs.githubFooter("", () => this.parent.setState({})) : undefined}
                </div>
            </div>
        )
    }
}
