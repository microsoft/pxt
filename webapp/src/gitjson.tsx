import * as React from "react"
import * as pkg from "./package"
import * as core from "./core"
import * as srceditor from "./srceditor"
import * as sui from "./sui"
import * as workspace from "./workspace";
import * as dialogs from "./dialogs";
import * as coretsx from "./coretsx";
import * as data from "./data";
import * as markedui from "./marked";
import * as compiler from "./compiler";
import * as cloudsync from "./cloudsync";
import * as tutorial from "./tutorial";
import * as _package from "./package";
import { fireClickOnEnter } from "./util"

const MAX_COMMIT_DESCRIPTION_LENGTH = 70;

interface DiffFile {
    file: pkg.File;
    name: string;
    gitFile: string;
    editorFile: string;
    // for blocks only
    tsGitFile?: string;
    tsEditorFile?: string;
}

interface DiffCache {
    file: DiffFile;
    diff: JSX.Element;
    whitespace?: boolean;
    revert?: () => void;
}

interface GithubProps {
    parent: pxt.editor.IProjectView;
}

interface GithubState {
    isVisible?: boolean;
    description?: string;
    needsCommitMessage?: boolean;
    previousCfgKey?: string;
    loadingMessage?: string;
}

class GithubComponent extends data.Component<GithubProps, GithubState> {
    private diffCache: pxt.Map<DiffCache> = {};

    constructor(props: GithubProps) {
        super(props);
        this.goBack = this.goBack.bind(this);
        this.handlePullClick = this.handlePullClick.bind(this);
        this.handleBranchClick = this.handleBranchClick.bind(this);
        this.handleGithubError = this.handleGithubError.bind(this);
        this.handlePullRequest = this.handlePullRequest.bind(this);
        this.handleSignoutGithub = this.handleSignoutGithub.bind(this);
    }

    clearCacheDiff(cachePrefix?: string, f?: DiffFile) {
        if (f)
            delete this.diffCache[cachePrefix + f.name];
        else
            this.diffCache = {};
    }

    cachedDiff(cachePrefix: string, f: DiffFile): DiffCache {
        let cache = this.diffCache[cachePrefix + f.name]
        if (!cache || cache.file.file !== f.file) {
            cache = { file: f } as any
            this.diffCache[cachePrefix + f.name] = cache
        }
        return cache;
    }

    fastForwardMergeAsync(githubId: pxt.github.ParsedRepo, pr: pxt.github.PullRequest, message: string) {
        message = message || pr.title || lf("Merge pull request");
        core.showLoading("github.merge", lf("merging pull request..."))
        return pxt.github.mergeAsync(githubId.fullName, pr.base, githubId.tag, `${message} (#${pr.number})`)
            .then(() => this.switchProjectToBranchAsync(pr.base))
            .then(() => this.pullAsync())
            .then(() => {
                core.hideLoading("github.merge");
                core.infoNotification("Pull request merged successfully!")
            })
            .then(() => this.handleGithubError)
            .finally(() => core.hideLoading("github.merge"))
            .then(() => { })
    }

    async revertAllFilesAsync() {
        pxt.tickEvent("github.revertall", { start: 1 }, { interactiveConsent: true })
        const res = await core.confirmAsync({
            header: lf("Would you like to revert all local changes?"),
            body: lf("Changes will be lost for good. No undo."),
            agreeLbl: lf("Revert"),
            agreeClass: "red",
            agreeIcon: "trash",
        })

        if (!res)
            return

        pxt.tickEvent("github.revertall", { ok: 1 })
        this.setState({ needsCommitMessage: false }); // maybe we no longer do

        const { header } = this.props.parent.state;
        await workspace.revertAllAsync(header);
        await this.props.parent.reloadHeaderAsync()
    }

    async revertFileAsync(f: DiffFile, deletedFiles: string[], addedFiles: string[], virtualFiles: pkg.File[]) {
        pxt.tickEvent("github.revert", { start: 1 }, { interactiveConsent: true })
        const res = await core.confirmAsync({
            header: lf("Would you like to revert changes to {0}?", f.name),
            body: lf("Changes will be lost for good. No undo."),
            agreeLbl: lf("Revert"),
            agreeClass: "red",
            agreeIcon: "trash",
        })

        if (!res)
            return

        pxt.tickEvent("github.revert", { ok: 1 })
        this.setState({ needsCommitMessage: false }); // maybe we no longer do

        let needsReload = false;
        const epkg = pkg.mainEditorPkg();
        if (f.gitFile == null) {
            needsReload = true;
            await epkg.removeFileAsync(f.name)
            for (const virtualF of virtualFiles)
                await epkg.removeFileAsync(virtualF.name)
        } else if (f.name == pxt.CONFIG_NAME) {
            needsReload = true;
            const gs = this.getGitJson()
            const parsed = this.parsedRepoId();
            for (let d of deletedFiles) {
                const prev = pxt.github.lookupFile(parsed, gs.commit, d)
                epkg.setFile(d, prev && prev.blobContent || "// Cannot restore.")
            }
            for (let d of addedFiles) {
                delete epkg.files[d]
            }
            await f.file.setContentAsync(f.gitFile)
        } else {
            await f.file.setContentAsync(f.gitFile)
            const pkgfiles = epkg.files;
            for (const virtualF of virtualFiles) {
                if (virtualF.baseGitContent == null) {
                    needsReload = true;
                    await epkg.removeFileAsync(virtualF.name)
                } else
                    await virtualF.setContentAsync(virtualF.baseGitContent);
            }
        }
        if (needsReload)
            await this.props.parent.reloadHeaderAsync()
        else
            this.forceUpdate()
    }

    private async saveGitJsonAsync(gs: pxt.github.GitJson) {
        const f = pkg.mainEditorPkg().files[pxt.github.GIT_JSON]
        await f.setContentAsync(JSON.stringify(gs, null, 4))
    }

    private async switchProjectToBranchAsync(newBranch: string) {
        const { header } = this.props.parent.state;
        const gs = this.getGitJson();
        const parsed = this.parsedRepoId()
        header.githubId = parsed.fullName + "#" + newBranch
        gs.repo = header.githubId
        await this.saveGitJsonAsync(gs)
        pkg.invalidatePullRequestStatus(header);
    }

    private async newBranchAsync() {
        await cloudsync.ensureGitHubTokenAsync();
        const gid = this.parsedRepoId()
        const initialBranchName = await pxt.github.getNewBranchNameAsync(gid.slug, "patch-")
        const branchName = await core.promptAsync({
            header: lf("New branch name"),
            body: lf("Name cannot have spaces or special characters. Examples: {0}",
                "my_feature, add-colors, fix_something"),
            agreeLbl: lf("Create"),
            initialValue: initialBranchName,
            hasCloseIcon: true,
            onInputValidation: v => {
                if (/[^\w\-]/.test(v))
                    return lf("Don't use spaces or special characters.")
                return undefined;
            }
        })
        if (!branchName)
            return

        this.showLoading("github.branch", true, lf("creating branch..."));
        try {
            const gs = this.getGitJson()
            await pxt.github.createNewBranchAsync(gid.slug, branchName, gs.commit.sha)
            await this.switchProjectToBranchAsync(branchName)
            this.forceUpdate();
        } catch (e) {
            this.handleGithubError(e);
        } finally {
            this.hideLoading();
        }
    }

    public async switchBranchAsync(branch: string) {
        await this.setStateAsync({ needsCommitMessage: false });
        const prevBranch = this.parsedRepoId().tag
        try {
            await this.switchProjectToBranchAsync(branch)
            await this.pullAsync()
        } finally {
            if (this.state.needsCommitMessage) {
                await this.switchProjectToBranchAsync(prevBranch)
            }
        }
    }

    public async showSwitchBranchDialogAsync() {
        const gid = this.parsedRepoId()
        const branches = await pxt.github.listRefsExtAsync(gid.slug, "heads")
        const branchList = Object.keys(branches.refs).map(r => ({
            name: r,
            description: branches.refs[r],
            onClick: async () => {
                core.hideDialog()
                await this.switchBranchAsync(r);
            }
        }))

        // only branch from main and master...
        if (gid.tag === "master" || gid.tag === "main") {
            branchList.unshift({
                name: lf("Create new branch"),
                description: lf("Based on {0}", gid.tag),
                onClick: () => {
                    core.hideDialog()
                    return this.newBranchAsync()
                }
            })
        }

        await core.confirmAsync({
            header: lf("Switch to a different branch"),
            hasCloseIcon: true,
            hideAgree: true,
            jsx: <div className="ui form">
                <div className="ui relaxed divided list" role="menu">
                    {branchList.map(r =>
                        <div key={r.name} className="item link">
                            <i className="large github middle aligned icon"></i>
                            <div className="content">
                                <a onClick={r.onClick} role="menuitem" className="header"
                                    tabIndex={0} onKeyDown={fireClickOnEnter}>{r.name}</a>
                                <div className="description">
                                    {r.description}
                                </div>
                            </div>
                        </div>)}
                </div>
            </div>,
        })
    }

    private handleBranchClick(e: React.MouseEvent<HTMLElement>) {
        pxt.tickEvent("github.branch");
        e.stopPropagation();
        this.showSwitchBranchDialogAsync();
    }

    private goBack() {
        pxt.tickEvent("github.backButton", undefined, { interactiveConsent: true })
        this.props.parent.openPreviousEditor()
    }

    private handlePullClick(e: React.MouseEvent<HTMLElement>) {
        pxt.tickEvent("github.pull");
        this.pullAsync();
    }

    async forkAsync(fromError: boolean) {
        const parsed = this.parsedRepoId()
        const provider = cloudsync.githubProvider();
        const user = provider.user();
        let org: JSX.Element = undefined;
        let rememberMe = false
        const handleRememberMeChanged = (v: boolean) => {
            rememberMe = v
            core.forceUpdate()
        }
        const handleAutorize = () => {
            pxt.tickEvent("github.authorize");
            const provider = cloudsync.githubProvider();
            provider.authorizeAppAsync(rememberMe);
        }
        if (fromError && user && parsed.owner !== user.userName) {
            // this is an org repo, so our OAuth app might not have been granted rights
            // test if the app can read the repo
            const isOrg = await pxt.github.isOrgAsync(parsed.owner);
            if (isOrg) {
                org = <div className="ui small">
                    {lf("If you already have write permissions to this repository, you may have to authorize the MakeCode App in the {0} organization.", parsed.owner)}
                    <sui.PlainCheckbox label={lf("Remember me")} onChange={handleRememberMeChanged} />
                    <sui.Link className="ui link" text={lf("Authorize MakeCode")} onClick={handleAutorize} onKeyDown={fireClickOnEnter} />
                </div>
            }
        }
        const error = fromError && <div className="ui message warning">
            {lf("Oops, we could not write to {0}.", parsed.slug)}
            {org}
        </div>;
        const help =
            <p>{lf("Forking creates a copy of {0} under your account. You can submit your changes back via a pull request.", parsed.slug)}</p>
        const res = await core.confirmAsync({
            header: lf("Do you want to fork {0}?", parsed.slug),
            hasCloseIcon: true,
            helpUrl: "/github/fork",
            jsx: <div>
                {error}
                {help}
            </div>,
            agreeLbl: "Fork",
            agreeIcon: "copy outline"
        })
        if (!res)
            return

        this.showLoading("github.fork", true, lf("forking repository (this may take a minute or two)..."))
        try {
            const gs = this.getGitJson();
            const newGithubId = await pxt.github.forkRepoAsync(parsed.slug, gs.commit.sha)
            const { header } = this.props.parent.state;
            header.githubId = newGithubId
            gs.repo = header.githubId
            await this.saveGitJsonAsync(gs)
        } catch (e) {
            this.handleGithubError(e)
        } finally {
            this.hideLoading();
        }
    }

    private handleGithubError(e: any) {
        const statusCode = parseInt(e.statusCode);
        if (e.isOffline || statusCode === 0)
            core.warningNotification(lf("Please connect to internet and try again."));
        else if (e.needsWritePermission) {
            // a few things may happen here:
            // - the user does not have rights, we should fork
            // - our oauth app doesnot have write access to the organization, we should tell the user to grant access
            //   or use a token
            core.hideDialog()
            this.forkAsync(true);
        }
        else if (e.isMergeConflictMarkerError) {
            pxt.tickEvent("github.commitwithconflicts");
            core.warningNotification(lf("Please merge all conflicts before commiting changes."))
        } else if (statusCode == 401) {
            cloudsync.githubProvider().clearToken();
            this.forceUpdate();
            core.warningNotification(lf("Please sign in to GitHub again."));
        }
        else if (statusCode == 404)
            core.warningNotification(lf("GitHub resource not found; please check that it still exists."));
        else if (statusCode == 403)
            core.warningNotification(lf("GitHub rate limit exceeded, please wait and try again."))
        else {
            pxt.reportException(e);
            core.warningNotification(lf("Oops, something went wrong. Please try again."))
        }
    }

    async bumpAsync() {
        // check all dependencies are ok
        try {
            workspace.prepareConfigForGithub(pkg.mainPkg.readFile(pxt.CONFIG_NAME), true);
        } catch (e) {
            core.warningNotification(e.message);
            return;
        }

        // we can't really trust the version pxt.json as the user may
        // have create new releases in github since there.
        // instead, we query the current tags and find the last one
        // automatically
        let currv = pkg.mainPkg.config.version;
        try {
            const ghid = this.parsedRepoId();
            const tags = await pxt.github.listRefsAsync(ghid.slug, "tags")
            const stags = pxt.semver.sortLatestTags(tags)
            currv = stags[0];
        } catch (e) {
            console.log(e)
        }
        const v = pxt.semver.parse(currv, "0.0.0")
        const vmajor = pxt.semver.parse(pxt.semver.stringify(v)); vmajor.major++; vmajor.minor = 0; vmajor.patch = 0;
        const vminor = pxt.semver.parse(pxt.semver.stringify(v)); vminor.minor++; vminor.patch = 0;
        const vpatch = pxt.semver.parse(pxt.semver.stringify(v)); vpatch.patch++;

        let bumpType: string = "patch";
        function onBumpChange(e: React.ChangeEvent<HTMLInputElement>) {
            bumpType = e.currentTarget.name;
            coretsx.forceUpdate();
        }
        let shouldCacheTutorial: boolean = false;
        function onCacheTutorialChange(e: React.ChangeEvent<HTMLInputElement>) {
            shouldCacheTutorial = !shouldCacheTutorial;
            coretsx.forceUpdate();
        }
        const ok = await core.confirmAsync({
            header: lf("Pick a release version"),
            agreeLbl: lf("Create release"),
            disagreeLbl: lf("Cancel"),
            jsxd: () => <div>
                <div className="grouped fields">
                    <label>{lf("Choose a release version that describes the changes you made to the code.")}
                        {sui.helpIconLink("/github/release#versioning", lf("Learn about version numbers."))}
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
                <div className="grouped fields">
                    <label>{lf("Advanced")}</label>
                    <div className="field checkbox">
                        <input type="checkbox" name="cachetutorial" checked={shouldCacheTutorial} aria-checked={shouldCacheTutorial} onChange={onCacheTutorialChange} />
                        <label>{lf("Optimize for tutorials by caching information about the markdown.")}</label>
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
        this.showLoading("github.release.new", true, lf("creating release..."));
        try {
            const { header } = this.props.parent.state;
            if (shouldCacheTutorial) await this.cacheTutorialInfo(header);
            await workspace.bumpAsync(header, newVer)
            pkg.mainPkg.config.version = newVer;
            await this.maybeReloadAsync()
            this.hideLoading();
            core.infoNotification(lf("GitHub release created."))
        } catch (e) {
            this.handleGithubError(e);
        } finally {
            this.hideLoading();
        }
    }

    private async cacheTutorialInfo(header: pxt.workspace.Header) {
        const mdRegex = /\.md$/;
        const githubId = this.parsedRepoId();

        let files = await workspace.getTextAsync(header.id);
        let mdPaths = Object.keys(files).filter(f => f.match(mdRegex));
        const tutorialInfo: pxt.Map<pxt.BuiltTutorialInfo> = {};
        for (let path of mdPaths) {
            const parsed = pxt.tutorial.parseTutorial(files[path]);
            const hash = pxt.BrowserUtils.getTutorialCodeHash(parsed.code);
            const tutorialBlocks = await tutorial.getUsedBlocksAsync(parsed.code, path, parsed.language, true);
            if (tutorialBlocks) {
                const formatPath = path.replace(mdRegex, "");
                tutorialInfo[`https://github.com/${githubId.fullName}${formatPath == "README" ? "" : "/" + formatPath}`] = {
                    snippetBlocks: tutorialBlocks.snippetBlocks,
                    usedBlocks: tutorialBlocks.usedBlocks,
                    highlightBlocks: tutorialBlocks.highlightBlocks,
                    validateBlocks: tutorialBlocks.validateBlocks,
                    hash
                };

            }
        }
        files[pxt.TUTORIAL_INFO_FILE] = JSON.stringify(tutorialInfo);

        let cfg = pxt.Package.parseAndValidConfig(files[pxt.CONFIG_NAME]);
        if (cfg.files.indexOf(pxt.TUTORIAL_INFO_FILE) < 0) {
            cfg.files.push(pxt.TUTORIAL_INFO_FILE);
            files[pxt.CONFIG_NAME] = pxt.Package.stringifyConfig(cfg);
        }

        await workspace.saveAsync(header, files);
        return await this.commitAsync()
    }

    private async showLoading(tick: string, ensureToken: boolean, msg: string) {
        if (ensureToken)
            await cloudsync.ensureGitHubTokenAsync();
        pxt.tickEvent(tick);
        await this.setStateAsync({ loadingMessage: msg });
        core.showLoading("githubjson", msg);
    }

    private hideLoading() {
        if (this.state.loadingMessage) {
            core.hideLoading("githubjson");
            this.setState({ loadingMessage: undefined });
        }
    }

    private pkgConfigKey(cfgtxt: string) {
        const cfg = JSON.parse(cfgtxt) as pxt.PackageConfig
        delete cfg.version
        return JSON.stringify(cfg)
    }

    private async maybeReloadAsync() {
        // here, the true state of files is stored in workspace
        const { header } = this.props.parent.state;
        const files = await workspace.getTextAsync(header.id);
        // save file content from workspace, so they won't get overridden
        pkg.mainEditorPkg().setFiles(files);
        // check if we need to reload header
        const newKey = this.pkgConfigKey(files[pxt.CONFIG_NAME])
        _package.invalidatePullStatus(header);
        if (newKey != this.state.previousCfgKey) {
            await this.setStateAsync({ previousCfgKey: newKey });
            await this.props.parent.reloadHeaderAsync();
        }
    }

    async pullAsync() {
        this.showLoading("github.pull", false, lf("pulling changes from GitHub..."));
        const { header } = this.props.parent.state;
        try {
            const status = await workspace.pullAsync(this.props.parent.state.header)
            switch (status) {
                case workspace.PullStatus.NoSourceControl:
                case workspace.PullStatus.UpToDate:
                    break
                case workspace.PullStatus.NeedsCommit:
                    this.setState({ needsCommitMessage: true });
                    break
                case workspace.PullStatus.GotChanges:
                    await this.maybeReloadAsync();
                    break
            }
        } catch (e) {
            this.handleGithubError(e);
        } finally {
            _package.invalidatePullStatus(header);
            this.hideLoading();
        }
    }

    private getGitJson(): pxt.github.GitJson {
        return pkg.mainPkg.readGitJson();
    }

    parsedRepoId() {
        const header = this.props.parent.state.header;
        return pxt.github.parseRepoId(header.githubId);
    }

    private async commitCoreAsync() {
        const { parent } = this.props;
        const { header } = parent.state;
        const repo = header.githubId;

        // pull changes and merge; if any conflicts, bail out
        await workspace.pullAsync(header);
        // check if any merge markers
        const hasConflicts = await workspace.hasMergeConflictMarkersAsync(header);
        if (hasConflicts) {
            // bail out
            // maybe needs a reload
            await this.maybeReloadAsync();
            core.warningNotification(lf("Merge conflicts found. Resolve them before commiting."))
            return;
        }

        // continue with commit
        let commitId = await workspace.commitAsync(header, {
            message: this.state.description,
            blocksScreenshotAsync: () => this.props.parent.blocksScreenshotAsync(1, pxt.appTarget.appTheme?.embedBlocksInSnapshot),
            blocksDiffScreenshotAsync: () => {
                const f = pkg.mainEditorPkg().sortedFiles().find(f => f.name == pxt.MAIN_BLOCKS);
                const diff = pxt.blocks.diffXml(f.baseGitContent, f.content);
                if (diff && diff.ws)
                    return pxt.blocks.layout.toPngAsync(diff.ws, 1);
                return Promise.resolve(undefined);
            }
        })
        if (commitId) {
            // merge failure; do a PR
            // we could ask the user, but it's unlikely they can do anything else to fix it
            let prUrl = await workspace.prAsync(header, commitId,
                this.state.description || lf("Commit conflict"))
            await dialogs.showPRDialogAsync(repo, prUrl)
            // when the dialog finishes, we pull again - it's possible the user
            // has resolved the conflict in the meantime
            await workspace.pullAsync(header)
            // skip bump in this case - we don't know if it was merged
        } else {
            pkg.invalidatePagesStatus(header);
            pkg.invalidatePullRequestStatus(header);
            // maybe needs a reload
            await this.maybeReloadAsync();
        }
        this.setState({ description: "" });
    }

    async commitAsync() {
        let success = true;
        this.setState({ needsCommitMessage: false });
        this.showLoading("github.commit", true, lf("commit and push changes to GitHub..."));
        try {
            await this.commitCoreAsync()
            await this.maybeReloadAsync()
        } catch (e) {
            success = false;
            pxt.tickEvent("github.commit.fail");
            this.handleGithubError(e);
        } finally {
            if (success) {
                pxt.tickEvent("github.commit.success");
            }
            this.hideLoading()
        }
    }

    setVisible(b: boolean) {
        if (b === this.state.isVisible) return;

        const { header } = this.props.parent.state
        if (b) {
            data.invalidateHeader("pkg-git-pr", header);
            this.setState({
                previousCfgKey: this.pkgConfigKey(pkg.mainEditorPkg().files[pxt.CONFIG_NAME].content)
            });
        } else {
            this.clearCacheDiff();
            this.setState({
                needsCommitMessage: false,
            });
        }
    }

    private async handlePullRequest() {
        const gh = this.parsedRepoId();
        let res = await core.confirmAsync({
            header: lf("Create pull request"),
            jsx: <p>{lf("Pull requests let you tell others about changes you've pushed to a branch in a repository on GitHub.")}</p>,
            helpUrl: "/github/pull-request",
            hasCloseIcon: true,
        });
        if (!res) return;

        const title = gh.tag; // maybe something better?
        this.showLoading("github.createpr", true, lf("creating pull request..."));
        try {
            const gh = this.parsedRepoId();
            const msg =
                `
### ${lf("How to use this pull request")}

- [ ] ${lf("assign a reviewer (you can be your own reviewer)")}
- [ ] ${lf("reviewer approves or requests changes")}
- [ ] ${lf("apply requested changes if any")}
- [ ] ${lf("merge once approved")}
`;
            const id = await pxt.github.createPRFromBranchAsync(gh.slug, "master", gh.tag, title, msg);
            data.invalidateHeader("pkg-git-pr", this.props.parent.state.header);
            core.infoNotification(lf("Pull request created successfully!", id));
        } catch (e) {
            if (e.statusCode == 422)
                core.warningNotification(lf("Please commit changes before creating a pull request."));
            else
                this.handleGithubError(e);
        } finally {
            this.hideLoading();
        }
    }

    private computeDiffFiles() {
        const files = pkg.mainEditorPkg().sortedFiles();
        const diffFiles = files
            .map<DiffFile>(p => {
                const c = p.publishedContent();
                if (p.baseGitContent == c)
                    return undefined;
                else {
                    const df: DiffFile = {
                        file: p,
                        name: p.name,
                        gitFile: p.baseGitContent,
                        editorFile: c
                    }
                    if (/\.blocks$/.test(p.name)) {
                        const vpn = p.getVirtualFileName(pxt.JAVASCRIPT_PROJECT_NAME);
                        const vp = files.find(ff => ff.name == vpn);
                        if (vp) {
                            df.tsGitFile = vp.baseGitContent;
                            df.tsEditorFile = vp.publishedContent();
                        }
                    }
                    return df;
                }
            })
            .filter(df => !!df);
        return diffFiles;
    }

    private async handleSignoutGithub() {
        pxt.tickEvent("github.signout");
        this.props.parent.signOutGithub();
    }

    renderCore(): JSX.Element {
        const gs = this.getGitJson();
        if (!gs)
            return <div></div>; // shortcut for projects not using github, should not happen when visible

        const { header } = this.props.parent.state;
        const isBlocksMode = pkg.mainPkg.getPreferredEditor() == pxt.BLOCKS_PROJECT_NAME;
        const diffFiles = this.computeDiffFiles();
        const needsCommit = diffFiles.length > 0;

        const pullStatus: workspace.PullStatus = this.getData("pkg-git-pull-status:" + header.id);
        const hasissue = pullStatus == workspace.PullStatus.BranchNotFound || pullStatus == workspace.PullStatus.NoSourceControl;
        const haspull = pullStatus == workspace.PullStatus.GotChanges;
        const githubId = this.parsedRepoId()
        const master = githubId.tag === "master";
        const main = githubId.tag === "main";
        const user = this.getData("github:user") as pxt.editor.UserInfo;

        // don't use gs.prUrl, as it gets cleared often
        const url = `https://github.com/${githubId.slug}/${master && !githubId.fileName ? "" : pxt.github.join("tree", githubId.tag || "master", githubId.fileName)}`;
        const needsToken = !pxt.github.token;
        // this will show existing PR if any
        const pr: pxt.github.PullRequest = this.getData("pkg-git-pr:" + header.id)
        const showPr = pr !== null && (gs.isFork || !master);
        const showPrResolved = showPr && pr && pr.number > 0;
        const showPrCreate = showPr && pr && pr.number <= 0;
        const isOwner = user && user.id === githubId.owner;
        return (
            <div id="githubArea">
                <div className="ui serialHeader">
                    <div className="leftHeaderWrapper">
                        <div className="leftHeader">
                            <sui.Button title={lf("Go back")} icon="arrow left" text={lf("Go back")} textClass="landscape only" tabIndex={0} onClick={this.goBack} onKeyDown={fireClickOnEnter} />
                        </div>
                    </div>
                    <div className="rightHeader">
                        <sui.Button icon={`${hasissue ? "exclamation circle" : haspull ? "long arrow alternate down" : "check"}`}
                            className={haspull === true ? "positive" : ""}
                            text={lf("Pull changes")} title={lf("Pull changes from GitHub to get your code up-to-date.")} onClick={this.handlePullClick} onKeyDown={fireClickOnEnter} />
                        {!isBlocksMode && isOwner &&
                            <sui.Link className="ui item button desktop only" icon="user plus" href={`https://github.com/${githubId.slug}/settings/collaboration`} target="_blank" title={lf("Invite others to contributes to this GitHub repository.")} />}
                        <sui.Link className="ui button" icon="external alternate" href={url} title={lf("Open repository in GitHub.")} target="_blank" onKeyDown={fireClickOnEnter} />
                    </div>
                </div>
                <MessageComponent parent={this} needsToken={needsToken} githubId={githubId} master={master} gs={gs} isBlocks={isBlocksMode} needsCommit={needsCommit} user={user} pullStatus={pullStatus} pullRequest={pr} />
                <div className="ui form">
                    {showPrResolved &&
                        <sui.Link href={pr.url} role="button" className="ui tiny basic button create-pr"
                            target="_blank" text={lf("Pull request (#{0})", pr.number)} icon="external alternate" />}
                    {showPrCreate &&
                        <sui.Button className="tiny basic create-pr" text={lf("Create pull request")} onClick={this.handlePullRequest} />
                    }
                    <h3 className="header">
                        <i className="large github icon" />
                        <span className="repo-name">{githubId.fullName}</span>
                        <span onClick={this.handleBranchClick} onKeyDown={fireClickOnEnter} tabIndex={0} role="button" className="repo-branch">{"#" + githubId.tag}<i className="dropdown icon" /></span>
                    </h3>
                    {needsCommit && <CommmitComponent parent={this} needsToken={needsToken} githubId={githubId} master={master} gs={gs} isBlocks={isBlocksMode} needsCommit={needsCommit} user={user} pullStatus={pullStatus} pullRequest={pr} />}
                    {showPrResolved && !needsCommit && <PullRequestZone parent={this} needsToken={needsToken} githubId={githubId} master={master} gs={gs} isBlocks={isBlocksMode} needsCommit={needsCommit} user={user} pullStatus={pullStatus} pullRequest={pr} />}
                    {diffFiles && <DiffView parent={this} diffFiles={diffFiles} cacheKey={gs.commit.sha} allowRevert={true} showWhitespaceDiff={true} blocksMode={isBlocksMode} showConflicts={true} />}
                    <HistoryZone parent={this} needsToken={needsToken} githubId={githubId} master={master} gs={gs} isBlocks={isBlocksMode} needsCommit={needsCommit} user={user} pullStatus={pullStatus} pullRequest={pr} />
                    {(master || main) && <ReleaseZone parent={this} needsToken={needsToken} githubId={githubId} master={master || main} gs={gs} isBlocks={isBlocksMode} needsCommit={needsCommit} user={user} pullStatus={pullStatus} pullRequest={pr} />}
                    {!isBlocksMode && <ExtensionZone parent={this} needsToken={needsToken} githubId={githubId} master={master} gs={gs} isBlocks={isBlocksMode} needsCommit={needsCommit} user={user} pullStatus={pullStatus} pullRequest={pr} />}
                    <div></div>
                </div>
                <div className="ui serialHeader">
                    <div className="rightHeader">
                        {user && <sui.Button className="ui button" icon="fas fa-sign-out-alt" text={lf("Disconnect GitHub")} title={lf("Log out of GitHub")} onClick={this.handleSignoutGithub} onKeyDown={fireClickOnEnter} />}
                    </div>
                </div>
            </div>
        )
    }
}

interface DiffViewProps {
    parent: GithubComponent;
    diffFiles: DiffFile[];
    cacheKey: string;
    allowRevert?: boolean;
    showWhitespaceDiff?: boolean;
    showConflicts?: boolean;
    blocksMode?: boolean;
}

class DiffView extends sui.StatelessUIElement<DiffViewProps> {

    constructor(props: DiffViewProps) {
        super(props);
        this.revertAllFiles = this.revertAllFiles.bind(this)
    }

    private lineDiff(lineA: string, lineB: string): { a: JSX.Element, b: JSX.Element } {
        const df = pxt.diff.compute(lineA.split("").join("\n"), lineB.split("").join("\n"), {
            context: Infinity
        })
        if (!df) // diff failed
            return {
                a: <div className="inline-diff"><code>{lineA}</code></div>,
                b: <div className="inline-diff"><code>{lineB}</code></div>
            }

        const ja: JSX.Element[] = []
        const jb: JSX.Element[] = []
        for (let i = 0; i < df.length;) {
            let j = i
            const mark = df[i][0]
            while (df[j] && df[j][0] == mark)
                j++
            const chunk = df.slice(i, j).map(s => s.slice(2)).join("")
            if (mark == " ") {
                ja.push(<code key={i} className="ch-common">{chunk}</code>)
                jb.push(<code key={i} className="ch-common">{chunk}</code>)
            } else if (mark == "-") {
                ja.push(<code key={i} className="ch-removed">{chunk}</code>)
            } else if (mark == "+") {
                jb.push(<code key={i} className="ch-added">{chunk}</code>)
            } else {
                pxt.Util.oops()
            }
            i = j
        }
        return {
            a: <div className="inline-diff">{ja}</div>,
            b: <div className="inline-diff">{jb}</div>
        }
    }

    private showDiff(f: DiffFile) {
        const { cacheKey, blocksMode, showConflicts, showWhitespaceDiff } = this.props;
        const cache = this.props.parent.cachedDiff(cacheKey, f);
        if (cache.diff
            && cache.file.gitFile == f.gitFile
            && cache.file.editorFile == f.editorFile)
            return cache.diff

        const isBlocks = /\.blocks$/.test(f.name)
        const showWhitespace = () => {
            if (!cache.whitespace) {
                cache.whitespace = true;
                cache.diff = createDiff();
                this.forceUpdate();
            }
        }
        const createDiff = () => {
            let jsxEls: { diffJSX: JSX.Element, legendJSX?: JSX.Element, conflicts: number };
            if (isBlocks) {
                jsxEls = this.createBlocksDiffJSX(f);
            } else {
                jsxEls = this.createTextDiffJSX(f, !cache.whitespace);
            }
            return <div key={`difffile${cacheKey}${f.name}`} className="ui segments filediff">
                <div className="ui segment diffheader">
                    {(!blocksMode || f.name != pxt.MAIN_BLOCKS) && <span>{f.name}</span>}
                    {!!cache.revert && <sui.Button className="small" icon="undo" text={lf("Revert")}
                        ariaLabel={lf("Revert file")} title={lf("Revert file")}
                        textClass={"landscape only"} onClick={cache.revert} />}
                    {jsxEls.legendJSX}
                    {showConflicts && !!jsxEls.conflicts && <p>{lf("Merge conflicts found. Resolve them before commiting.")}</p>}
                    {!!cache.revert && !!deletedFiles.length &&
                        <p>
                            {lf("Reverting this file will also restore: {0}", deletedFiles.join(", "))}
                        </p>}
                    {!!cache.revert && !!addedFiles.length &&
                        <p>
                            {lf("Reverting this file will also remove: {0}", addedFiles.join(", "))}
                        </p>}
                    {!!cache.revert && !!virtualFiles.length && !blocksMode && <p>
                        {lf("Reverting this file will also revert: {0}", virtualFiles.map(f => f.name).join(', '))}
                    </p>}
                </div>
                {jsxEls.diffJSX ?
                    <div className="ui segment diff">
                        {jsxEls.diffJSX}
                    </div>
                    :
                    <div className="ui segment">
                        <p>
                            {lf("Whitespace changes only.")}
                            {showWhitespaceDiff &&
                                <sui.Link className="link" text={lf("Show")} onClick={showWhitespace} />}
                        </p>
                    </div>
                }
            </div>;
        }

        let deletedFiles: string[] = []
        let addedFiles: string[] = []
        if (f.name == pxt.CONFIG_NAME) {
            const oldConfig = pxt.Package.parseAndValidConfig(f.gitFile);
            const newConfig = pxt.Package.parseAndValidConfig(f.editorFile);
            if (oldConfig && newConfig) {
                const oldCfg = pxt.allPkgFiles(oldConfig);
                const newCfg = pxt.allPkgFiles(newConfig);
                deletedFiles = oldCfg.filter(fn => newCfg.indexOf(fn) == -1)
                addedFiles = newCfg.filter(fn => oldCfg.indexOf(fn) == -1)
            }
        }

        const virtualFiles: pkg.File[] = [];
        cache.file = f
        if (this.props.allowRevert) {
            // backing .ts for .blocks/.py files
            const files = pkg.mainEditorPkg().files;
            const virtualFile = blocksMode && files[f.file.getVirtualFileName(pxt.JAVASCRIPT_PROJECT_NAME)];
            if (virtualFile && virtualFile != f.file)
                virtualFiles.push(virtualFile);
            // erase other generated files
            for (const vf of pkg.mainEditorPkg().getGeneratedFiles(f.file))
                virtualFiles.push(vf);
            cache.revert = () => this.props.parent.revertFileAsync(f, deletedFiles, addedFiles, virtualFiles);
        }
        cache.diff = createDiff()
        return cache.diff;
    }

    private createBlocksDiffJSX(f: DiffFile): { diffJSX: JSX.Element, legendJSX?: JSX.Element, conflicts: number } {
        const baseContent = f.gitFile || "";
        const content = f.editorFile;

        let diffJSX: JSX.Element;
        if (!content) {
            // the xml payload needs to be decompiled
            diffJSX = <div className="ui basic segment">{lf("Your blocks were updated. Go back to the editor to view the changes.")}</div>
        } else {
            // if the xml is completed reconstructed,
            // bail off to decompiled diffs
            let markdown: string;
            if (f.tsEditorFile &&
                pxt.blocks.needsDecompiledDiff(baseContent, content)
            ) {
                markdown =
                    `
\`\`\`diffblocks
${f.tsGitFile || ""}
---------------------
${f.tsEditorFile}
\`\`\`
`;

            } else {
                markdown =
                    `
\`\`\`diffblocksxml
${baseContent}
---------------------
${content}
\`\`\`
`;
            }
            diffJSX = <markedui.MarkedContent key={`diffblocksxxml${f.name}`} parent={this.props.parent.props.parent} markdown={markdown} />
        }
        const legendJSX = <p className="legend">
            <span><span className="added icon"></span>{lf("added, changed or moved")}</span>
            <span><span className="deleted icon"></span>{lf("deleted")}</span>
            <span><span className="notchanged icon"></span>{lf("not changed")}</span>
            {sui.helpIconLink("/github/diff#blocks", lf("Learn about reading differences in blocks code."))}
        </p>;
        return { diffJSX, legendJSX, conflicts: 0 };
    }

    private createTextDiffJSX(f: DiffFile, ignoreWhitespace: boolean): { diffJSX: JSX.Element, legendJSX?: JSX.Element, conflicts: number } {
        const { showConflicts } = this.props;
        const baseContent = f.gitFile || "";
        const content = f.editorFile || "";
        const classes: pxt.Map<string> = {
            "@": "diff-marker",
            " ": "diff-unchanged",
            "+": "diff-added",
            "-": "diff-removed",
        }
        const diffLines = pxt.diff.compute(baseContent, content, { ignoreWhitespace: !!ignoreWhitespace })
        if (!diffLines) {
            pxt.tickEvent("github.diff.toobig");
            return {
                diffJSX: <div>{lf("Too many differences to render diff.")}</div>,
                conflicts: 0
            }
        }
        let conflicts = 0;
        let conflictState: "local" | "remote" | "footer" | "" = "";
        let lnA = 0, lnB = 0
        let lastMark = ""
        let savedDiff: JSX.Element = null
        const linesTSX: JSX.Element[] = [];
        diffLines.forEach((ln, idx) => {
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
            const nextMark = diffLines[idx + 1] ? diffLines[idx + 1][0] : ""
            const next2Mark = diffLines[idx + 2] ? diffLines[idx + 2][0] : ""
            const lnSrc = ln.slice(2);
            let currDiff = <code>{lnSrc}</code>

            if (savedDiff) {
                currDiff = savedDiff
                savedDiff = null
            } else if (ln[0] == "-" && (lastMark == " " || lastMark == "@") && nextMark == "+"
                && (next2Mark == " " || next2Mark == "@" || next2Mark == "")) {
                const r = this.lineDiff(ln.slice(2), diffLines[idx + 1].slice(2))
                currDiff = r.a
                savedDiff = r.b
            }
            lastMark = ln[0];
            let diffMark = lastMark;
            let postTSX: JSX.Element;
            if (lastMark == "+" && /^<<<<<<<[^<]/.test(lnSrc)) {
                conflicts++;
                conflictState = "local";
                diffMark = "@";
                linesTSX.push(<tr key={"conflictheader" + lnA + lnB} className="conflict ui small header">
                    <td colSpan={4} className="ui small header">{lf("Merge conflict")}</td>
                </tr>);
                linesTSX.push(<tr key={"conflictdescr" + lnA + lnB} className="conflict ui description">
                    <td colSpan={4} className="ui small description">
                        {lf("Changes from GitHub are conflicting with local changes.")}
                        {sui.helpIconLink("/github/merge-conflict", lf("Learn about merge conflicts and resolution."))}
                    </td>
                </tr>);
                const lnMarker = Math.min(lnA, lnB);
                const keepLocalHandler = () => this.handleMergeConflictResolution(f, lnMarker, true, false);
                const keepRemoteHandler = () => this.handleMergeConflictResolution(f, lnMarker, false, true);
                const keepBothHandler = () => this.handleMergeConflictResolution(f, lnMarker, true, true);
                if (showConflicts) {
                    linesTSX.push(<tr key={"merge" + lnA + lnB} className="conflict ui mergebtn">
                        <td colSpan={4} className="ui">
                            <sui.Button className="compact" text={lf("Keep local")} title={lf("Ignore the changes from GitHub.")} onClick={keepLocalHandler} />
                            <sui.Button className="compact" text={lf("Keep remote")} title={lf("Override local changes with changes from GitHub.")} onClick={keepRemoteHandler} />
                            <sui.Button className="compact" text={lf("Keep both")} title={lf("Keep both local and remote changes.")} onClick={keepBothHandler} />
                        </td>
                    </tr>);
                }
            }
            else if (lastMark == "+" && /^>>>>>>>[^>]/.test(lnSrc)) {
                conflictState = "footer";
                diffMark = "@";
            }
            else if (lastMark == "+" && /^=======$/.test(lnSrc)) {
                diffMark = "@";
                conflictState = "remote";
            }

            // add diff
            const isMarker = diffMark == "@";
            const className = `${conflictState ? "conflict" : ""} ${conflictState} ${classes[diffMark]}`;
            linesTSX.push(
                <tr key={lnA + lnB} className={className}>
                    <td className="line-a" data-content={lnA}></td>
                    <td className="line-b" data-content={lnB}></td>
                    {isMarker
                        ? <td colSpan={2} className="change"><code>{ln}</code></td>
                        : <td className="marker" data-content={diffMark}></td>
                    }
                    {isMarker
                        ? undefined
                        : <td className="change">{currDiff}</td>
                    }
                </tr>);

            if (postTSX)
                linesTSX.push(postTSX);

            if (conflictState == "footer")
                conflictState = "";
        })
        const diffJSX = linesTSX.length ? <table className="diffview">
            <tbody>
                {linesTSX}
            </tbody>
        </table> : undefined;
        const legendJSX: JSX.Element = undefined;

        return { diffJSX, legendJSX, conflicts }
    }

    private handleMergeConflictResolution(f: DiffFile, startMarkerLine: number, local: boolean, remote: boolean) {
        pxt.tickEvent("github.conflict.resolve", { "local": local ? 1 : 0, "remote": remote ? 1 : 0 }, { interactiveConsent: true });

        const content = pxt.diff.resolveMergeConflictMarker(f.file.content, startMarkerLine, local, remote);
        f.file.setContentAsync(content)
            .then(() => this.props.parent.clearCacheDiff(this.props.cacheKey, f)) // clear cached diff
            .then(() => this.props.parent.forceUpdate());
    }

    revertAllFiles() {
        this.props.parent.revertAllFilesAsync();
    }

    renderCore() {
        const { diffFiles, blocksMode, allowRevert } = this.props;
        const targetTheme = pxt.appTarget.appTheme;
        const invertedTheme = targetTheme.invertedMenu && targetTheme.invertedMonaco;

        const displayDiffFiles = blocksMode
            && !pxt.options.debug ? diffFiles.filter(f => /\.blocks$/.test(f.name))
            : diffFiles;
        return diffFiles.length ? <div className="ui section">
            <div className={`ui ${invertedTheme ? "inverted " : ""} diffheader segment`}>
                {lf("There are local changes.")}
                {allowRevert && <sui.Button className="small" icon="undo" text={lf("Revert all")}
                    ariaLabel={lf("Revert all changes")} title={lf("Revert all changes")}
                    textClass={"landscape only"} onClick={this.revertAllFiles} />}
            </div>
            {displayDiffFiles.map(df => this.showDiff(df))}
        </div> : <div className={`ui ${invertedTheme ? "inverted " : ""}segment`}>
                {lf("No local changes found.")}
            </div>;
    }
}

class MessageComponent extends sui.StatelessUIElement<GitHubViewProps> {
    constructor(props: GitHubViewProps) {
        super(props)
        this.handleSwitchMasterBranch = this.handleSwitchMasterBranch.bind(this);
    }

    private handleSwitchMasterBranch(e: React.MouseEvent<HTMLElement>) {
        pxt.tickEvent("github.branch.switch");
        e.stopPropagation();
        this.props.parent.switchBranchAsync("master");
    }

    renderCore() {
        const { needsCommitMessage } = this.props.parent.state;
        const { pullStatus, pullRequest, githubId } = this.props;

        const closed = pullRequest?.state == "CLOSED"
        const merged = pullRequest?.state == "MERGED"
        if (closed || merged)
            return <div className="ui icon negative message">
                <i className="exclamation circle icon"></i>
                <div className="content">
                    {closed && lf("This Pull Request is closed!")}
                    {merged && lf("This pull request has been merged.")}
                    <span role="button" className="ui link" onClick={this.handleSwitchMasterBranch} onKeyDown={fireClickOnEnter}>{lf("Switch to master branch")}</span>
                </div>
            </div>;

        if (pullStatus == workspace.PullStatus.NoSourceControl)
            return <div className="ui icon warning message">
                <i className="exclamation circle icon"></i>
                <div className="content">
                    {lf("This repository was not found. It might have been deleted or you may not have rights to access it.")}
                    <sui.Link href={`https://github.com/${githubId.slug}`} text={lf("Go to GitHub")} />
                </div>
            </div>

        if (pullStatus == workspace.PullStatus.BranchNotFound)
            return <div className="ui icon warning message">
                <i className="exclamation circle icon"></i>
                <div className="content">
                    {lf("This branch was not found, please pull again or switch to a different branch.")}
                    <span role="button" className="ui link" onClick={this.handleSwitchMasterBranch} onKeyDown={fireClickOnEnter}>{lf("Switch to master branch")}</span>
                </div>
            </div>

        if (needsCommitMessage)
            return <div className="ui warning message">
                <div className="content">
                    {lf("You need to commit your changes before you can pull from GitHub.")}
                </div>
            </div>

        return <div />;
    }
}

interface GitHubViewProps {
    githubId: pxt.github.ParsedRepo;
    needsToken: boolean;
    master: boolean;
    parent: GithubComponent;
    gs: pxt.github.GitJson;
    isBlocks: boolean;
    needsCommit: boolean;
    user: pxt.editor.UserInfo;
    pullStatus: workspace.PullStatus;
    pullRequest: pxt.github.PullRequest;
}

class CommmitComponent extends sui.StatelessUIElement<GitHubViewProps> {
    constructor(props: GitHubViewProps) {
        super(props)
        this.handleDescriptionChange = this.handleDescriptionChange.bind(this);
        this.handleCommitClick = this.handleCommitClick.bind(this);
    }

    private handleDescriptionChange(v: string) {
        this.props.parent.setState({ description: v });
    }

    private async handleCommitClick(e: React.MouseEvent<HTMLElement>) {
        pxt.tickEvent("github.commit");
        e.stopPropagation();
        await cloudsync.githubProvider().loginAsync();
        if (pxt.github.token)
            await this.props.parent.commitAsync();
    }

    renderCore() {
        const { description } = this.props.parent.state;
        const descrError = description && description.length > MAX_COMMIT_DESCRIPTION_LENGTH
            ? lf("Your description is getting long...") : undefined;
        return <div>
            <div className="ui field">
                <sui.Input type="text" placeholder={lf("Describe your changes.")} value={this.props.parent.state.description} onChange={this.handleDescriptionChange}
                    error={descrError} />
            </div>
            <div className="ui field">
                <sui.Button className="green" text={lf("Commit and push changes")} icon="long arrow alternate up" onClick={this.handleCommitClick} onKeyDown={fireClickOnEnter} />
                <span className="inline-help">{lf("Save your changes in GitHub.")}
                    {sui.helpIconLink("/github/commit", lf("Learn about commiting and pushing code into GitHub."))}
                </span>
            </div>
        </div>
    }
}

class PullRequestZone extends sui.StatelessUIElement<GitHubViewProps> {
    constructor(props: GitHubViewProps) {
        super(props);
        this.handleMergeClick = this.handleMergeClick.bind(this);
    }

    private scheduleRefreshPullRequestStatus = pxtc.Util.debounce(() => {
        const header = this.props.parent.props.parent.state.header;
        if (!header) return;
        pkg.invalidatePullRequestStatus(header);
        this.pullRequestStatus();
    }, 10000, false);

    private pullRequestStatus() {
        const header = this.props.parent.props.parent.state.header;
        const pr: pxt.github.PullRequest = this.props.parent.getData("pkg-git-pr:" + header.id)

        // schedule a refresh
        if (pr?.mergeable === "UNKNOWN" && pr?.state === "OPEN")
            this.scheduleRefreshPullRequestStatus();
        return pr;
    }

    private handleMergeClick(e: React.MouseEvent<HTMLElement>) {
        pxt.tickEvent("github.pr.merge", null, { interactiveConsent: true });
        e.stopPropagation();

        const { githubId } = this.props;
        const header = this.props.parent.props.parent.state.header;
        const pr: pxt.github.PullRequest = this.props.parent.getData("pkg-git-pr:" + header.id)
        core.promptAsync({
            header: lf("Squash and merge?"),
            jsx: <p>{lf("Your changes will merged as a single commit into the base branch and you will switch back to the base branch.")}</p>,
            agreeLbl: lf("Confirm merge"),
            helpUrl: "/github/pull-request",
            hasCloseIcon: true,
            placeholder: lf("Describe your changes")
        }).then(message => {
            if (message === null) return Promise.resolve();
            return this.props.parent.fastForwardMergeAsync(githubId, pr, message);
        })
    }

    renderCore() {
        const { gs, githubId } = this.props;
        const pullRequest = this.pullRequestStatus();
        const merging = !!gs.mergeSha;
        const mergeable = pullRequest.mergeable === "MERGEABLE";
        const open = pullRequest.state === "OPEN";
        const mergeableUnknown = open && pullRequest.mergeable === "UNKNOWN";
        const icon = merging ? "sync" : mergeable ? "check" : mergeableUnknown ? "circle outline" : "exclamation triangle";
        const color = merging ? "orange" : mergeable ? "green" : mergeableUnknown ? "orange" : "grey";
        const msg = merging ? lf("A merge is in progress. Please resolve conflicts or cancel it")
            : mergeable ? lf("This branch has no conflicts with the base branch")
                : mergeableUnknown ? lf("Checking if your branch can be merged")
                    : lf("This branch has conflicts that must be resolved");

        if (!open) return <div></div>; // handled elsewhere

        /*
                    {!mergeableUnknown && <div className="ui field">
                        <sui.Button text={lf("Sync branch")}
                            onClick={this.handleMergeUpstreamClick} onKeyDown={fireClickOnEnter} />
                        <span className="inline-help">{lf("Merge changes from master into this branch.")}</span>
                    </div>}
        */

        return <div className={`ui ${color} segment`}>
            <div className="ui field">
                <div className="ui">
                    <i className={`icon ${color} inverted circular ${icon}`} />
                    {msg}
                </div>
            </div>
            {(!mergeable && !mergeableUnknown) && <div className="ui field">
                <sui.Link className="button" text={lf("Resolve conflicts")}
                    href={`https://github.com/${githubId.slug}/pull/${pullRequest.number}/conflicts`}
                    target="_blank" />
                <span className="inline-help">{lf("Resolve merge conflicts in GitHub.")}
                    {sui.helpIconLink("/github/pull-requests", lf("Learn about merging pull requests in GitHub."))}
                </span>
            </div>}
            {mergeable && <div className="ui field">
                <sui.Button className={color} text={lf("Squash and merge")}
                    onClick={this.handleMergeClick} onKeyDown={fireClickOnEnter} />
                <span className="inline-help">{lf("Merge your changes as a single commit into the base branch.")}
                    {sui.helpIconLink("/github/pull-requests", lf("Learn about merging pull requests in GitHub."))}
                </span>
            </div>}
        </div>
    }
}

class ReleaseZone extends sui.StatelessUIElement<GitHubViewProps> {
    constructor(props: GitHubViewProps) {
        super(props);
        this.handleBumpClick = this.handleBumpClick.bind(this);
    }

    private handleBumpClick(e: React.MouseEvent<HTMLElement>) {
        pxt.tickEvent("github.releasezone.bump", undefined, { interactiveConsent: true });
        e.stopPropagation();
        const { needsCommit, master } = this.props;
        const header = this.props.parent.props.parent.state.header;
        if (needsCommit)
            core.confirmAsync({
                header: lf("Commit your changes..."),
                body: lf("You need to commit your local changes to create a release."),
                agreeLbl: lf("Ok"),
                hideAgree: true
            });
        else if (!master)
            core.confirmAsync({
                header: lf("Checkout the master branch..."),
                body: lf("You need to checkout the master branch to create a release."),
                agreeLbl: lf("Ok"),
                hideAgree: true
            });
        else
            cloudsync.githubProvider()
                .loginAsync()
                .then(() => pxt.github.token && this.props.parent.bumpAsync())
                .finally(() => pkg.invalidatePagesStatus(header))
    }

    private scheduleRefreshPageStatus = pxtc.Util.debounce(() => {
        const header = this.props.parent.props.parent.state.header;
        if (!header) return;
        pkg.invalidatePagesStatus(header);
        this.pagesStatus();
    }, 10000, false);

    private pagesStatus() {
        const header = this.props.parent.props.parent.state.header;
        const pages = this.props.parent.getData("pkg-git-pages:" + header.id) as pxt.github.GitHubPagesStatus;

        // schedule a refresh
        if (pages && pages.status == "building")
            this.scheduleRefreshPageStatus();

        return pages;
    }

    renderCore() {
        const { gs, needsCommit } = this.props;
        const tag = gs.commit && gs.commit.tag;
        const compiledJs = !!pxt.appTarget.appTheme.githubCompiledJs;

        if (needsCommit) // nothing to show here
            return <div></div>

        const pages = this.pagesStatus();
        const hasPages = pages && !!pages.html_url;
        const pagesBuilding = pages && pages.status == "building";
        const inverted = !!pxt.appTarget.appTheme.invertedGitHub;
        return <div className={`ui transparent ${inverted ? 'inverted' : ''} segment`}>
            <div className="ui header">{lf("Release zone")}</div>
            {!needsCommit && !tag && <div className="ui field">
                <sui.Button
                    className="basic"
                    text={lf("Create release")}
                    inverted={inverted}
                    onClick={this.handleBumpClick}
                    onKeyDown={fireClickOnEnter} />
                <span className="inline-help">
                    {lf("Snapshot and publish your code.")}
                    {sui.helpIconLink("/github/release", lf("Learn more about extension releases."))}
                </span>
            </div>}
            {!needsCommit && tag &&
                <div className="ui field">
                    <p className="inline-help">{lf("Current release: {0}", tag)}
                        {sui.helpIconLink("/github/release", lf("Learn about releases."))}
                    </p>
                </div>}
            {hasPages &&
                <div className="ui field">
                    <sui.Link className="basic button"
                        href={pages.html_url}
                        inverted={inverted}
                        loading={pagesBuilding}
                        text={lf("Open Pages")}
                        target="_blank" />
                    <span className="inline-help">
                        {pagesBuilding ? lf("Pages building, it may take a few minutes.")
                            : compiledJs ? lf("Commit & create release to update Pages.")
                                : lf("Commit to update Pages.")}
                        {sui.helpIconLink("/github/pages", lf("Learn about GitHub Pages."))}
                    </span>
                </div>}
        </div>
    }
}

class ExtensionZone extends sui.StatelessUIElement<GitHubViewProps> {
    constructor(props: GitHubViewProps) {
        super(props);
        this.handleForkClick = this.handleForkClick.bind(this);
        this.handleSaveClick = this.handleSaveClick.bind(this);
    }

    private handleForkClick(e: React.MouseEvent<HTMLElement>) {
        pxt.tickEvent("github.extensionzone.fork", undefined, { interactiveConsent: true });
        e.stopPropagation();
        this.props.parent.forkAsync(false);
    }

    private handleSaveClick(e: React.MouseEvent<HTMLElement>) {
        pxt.tickEvent("github.extensionzone.save", undefined, { interactiveConsent: true });
        e.stopPropagation();
        this.props.parent.props.parent.saveAndCompile();
    }

    renderCore() {
        const { needsToken, githubId, gs, user } = this.props;
        const header = this.props.parent.props.parent.state.header;
        const needsLicenseMessage = !needsToken && gs.commit && !gs.commit.tree.tree.some(f =>
            /^LICENSE/.test(f.path.toUpperCase()) || /^COPYING/.test(f.path.toUpperCase()))
        const testurl = header && `${window.location.href.replace(/#.*$/, '')}#testproject:${header.id}`;
        const showFork = user && user.id != githubId.owner;

        const inverted = !!pxt.appTarget.appTheme.invertedGitHub;
        return <div className={`ui transparent ${inverted ? 'inverted' : ''} segment`}>
            <div className="ui header">{lf("Extension zone")}</div>
            <div className="ui field">
                <sui.Link className="basic button"
                    href={testurl}
                    inverted={inverted}
                    text={lf("Test Extension")}
                    target={`${pxt.appTarget.id}testproject`} />
                <span className="inline-help">
                    {lf("Open a test project that uses this extension.")}
                    {sui.helpIconLink("/github/test-extension", lf("Learn about testing extensions."))}
                </span>
            </div>
            {showFork && <div className="ui field">
                <sui.Button className="basic" text={lf("Fork repository")}
                    onClick={this.handleForkClick}
                    inverted={inverted}
                    onKeyDown={fireClickOnEnter} />
                <span className="inline-help">
                    {lf("Fork your own copy of {0} to your account.", githubId.slug)}
                    {sui.helpIconLink("/github/fork", lf("Learn more about forking repositories."))}
                </span>
            </div>}
            {needsLicenseMessage && <div className={`ui field`}>
                <sui.Link className="basic button"
                    href={`https://github.com/${githubId.slug}/community/license/new?branch=${githubId.tag}&template=mit`}
                    inverted={inverted}
                    text={lf("Add license")}
                    target={"_blank"} />
                <span className="inline-help">
                    {lf("Your project doesn't seem to have a license.")}
                    {sui.helpIconLink("/github/license", lf("Learn more about licenses."))}
                </span>
            </div>}
            <div className="ui field">
                <sui.Button className="basic" text={lf("Save for offline")}
                    onClick={this.handleSaveClick}
                    inverted={inverted}
                    onKeyDown={fireClickOnEnter} />
                <span className="inline-help">
                    {lf("Export this extension to a file that can be imported without Internet.")}
                    {sui.helpIconLink("/github/offline", lf("Learn more about offline support for extensions."))}
                </span>
            </div>
        </div>
    }
}

interface CommitViewProps {
    parent: GithubComponent;
    githubId: pxt.github.ParsedRepo;
    commit: pxt.github.CommitInfo;
    expanded: boolean;
    onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

interface CommitViewState {
    diffFiles?: DiffFile[];
    loading?: boolean;
}

class CommitView extends sui.UIElement<CommitViewProps, CommitViewState> {
    constructor(props: CommitViewProps) {
        super(props);
        this.handleRestore = this.handleRestore.bind(this);
    }

    private loadDiffFilesAsync() {
        // load commit and compute markdown
        const { githubId, commit } = this.props;
        this.setState({ loading: true });
        pxt.github.getCommitAsync(githubId.slug, commit.sha)
            .then(cmt => this.computeDiffAsync(cmt))
            .then(dfs => this.setState({ diffFiles: dfs }))
            .finally(() => this.setState({ loading: false }))
    }

    private computeDiffAsync(commit: pxt.github.Commit): Promise<DiffFile[]> {
        const { githubId } = this.props;
        const files = pkg.mainEditorPkg().sortedFiles();
        const oldFiles: pxt.Map<string> = {};

        return Promise.all(
            files.map(p => {
                const path = p.name;
                const oldEnt = pxt.github.lookupFile(githubId, commit, path);
                if (!oldEnt) return Promise.resolve();
                return pxt.github.downloadTextAsync(githubId.fullName, commit.sha, path)
                    .then(content => { oldFiles[path] = content; });
            }))
            .then(() => files.map(p => {
                const path = p.name;
                const oldContent = oldFiles[path];
                const isBlocks = /\.blocks$/.test(path);
                const newContent = p.publishedContent();
                const hasChanges = oldContent !== newContent;
                if (!hasChanges) return undefined;
                const df: DiffFile = {
                    file: p,
                    name: p.name,
                    gitFile: oldContent,
                    editorFile: newContent
                }
                if (isBlocks && pxt.blocks.needsDecompiledDiff(oldContent, newContent)) {
                    const vpn = p.getVirtualFileName(pxt.JAVASCRIPT_PROJECT_NAME);
                    const virtualNewFile = files.find(ff => ff.name == vpn);
                    const virtualOldContent = oldFiles[vpn];
                    if (virtualNewFile && virtualOldContent) {
                        df.tsEditorFile = virtualNewFile.publishedContent();
                        df.tsGitFile = virtualOldContent;
                    }
                }
                return df;
            })).then(diffs => diffs.filter(df => !!df));
    }

    handleRestore(e: React.MouseEvent<HTMLElement>) {
        e.stopPropagation();
        pxt.tickEvent("github.restore", undefined, { interactiveConsent: true })
        const { commit } = this.props;
        core.confirmAsync({
            header: lf("Would you like to restore this commit?"),
            body: lf("You will restore your project to the point in time when this commit was made. Don't worry, you can undo this action by restoring to the previous commit."),
            agreeLbl: lf("Restore"),
            agreeClass: "green",
        }).then(r => {
            if (!r) return;
            core.showLoading("github.restore", lf("restoring commit..."))
            workspace.restoreCommitAsync(this.props.parent.props.parent.state.header, commit)
                .then(() => {
                    data.invalidate("gh-commits:*");
                    return this.props.parent.props.parent.reloadHeaderAsync();
                })
                .finally(() => core.hideLoading("github.restore"))
        })
        return false;
    }

    renderCore() {
        const { parent, commit, expanded, onClick } = this.props;
        const { diffFiles, loading } = this.state;
        const date = new Date(Date.parse(commit.author.date));

        if (expanded && !diffFiles && !loading)
            this.loadDiffFilesAsync();

        return <div className={`ui item link`} role="button" onClick={onClick} onKeyDown={fireClickOnEnter}>
            <div className="content">
                {expanded && <sui.Button loading={loading} className="right floated" text={lf("Restore")} onClick={this.handleRestore} onKeyDown={fireClickOnEnter} />}
                <div className="meta">
                    <span>{date.toLocaleTimeString()}</span>
                </div>
                <div className="description">{commit.message}</div>
                {expanded && diffFiles && <div className="ui inverted segment">{lf("Comparing selected commit with local files")}</div>}
                {expanded && diffFiles && <DiffView parent={parent} blocksMode={false} diffFiles={diffFiles} cacheKey={commit.sha} />}
            </div>
        </div>
    }
}

interface HistoryState {
    expanded?: boolean;
    selectedCommit?: pxt.github.CommitInfo;
    selectedDay?: string;
}

class HistoryZone extends sui.UIElement<GitHubViewProps, HistoryState> {
    constructor(props: GitHubViewProps) {
        super(props);
        this.handleLoadClick = this.handleLoadClick.bind(this);
    }

    handleLoadClick() {
        pxt.tickEvent("github.history.load", undefined, { interactiveConsent: true });
        const { expanded } = this.state;
        this.setState({ expanded: !expanded, selectedCommit: undefined, selectedDay: undefined })
    }

    renderCore() {
        const { githubId, gs, parent } = this.props;
        const { selectedCommit, expanded, selectedDay } = this.state;
        const inverted = !!pxt.appTarget.appTheme.invertedGitHub;
        const commits = expanded &&
            this.getData(`gh-commits:${githubId.slug}#${gs.commit.sha}`) as pxt.github.CommitInfo[];
        const loading = expanded && !commits;

        // group commits by day
        const days: pxt.Map<pxt.github.CommitInfo[]> = {};
        if (commits)
            commits.forEach(commit => {
                const day = new Date(Date.parse(commit.author.date)).toLocaleDateString();
                let dcommit = days[day];
                if (!dcommit) dcommit = days[day] = [];
                dcommit.push(commit);
            })

        return <div className={`ui transparent ${inverted ? 'inverted' : ''} segment`}>
            <div className="ui header">{lf("History")}</div>
            {(loading || !expanded) && <div className="ui field">
                <sui.Button loading={loading} className="basic" text={lf("View commits")}
                    onClick={this.handleLoadClick}
                    inverted={inverted}
                    onKeyDown={fireClickOnEnter} />
                <span className="inline-help">
                    {lf("Restore your project to a previous commit.")}
                    {sui.helpIconLink("/github/history", lf("Learn more about history of commits."))}
                </span>
            </div>}
            {commits && <div className="ui items">
                {Object.keys(days).map(day =>
                    <div role="button" className="ui link item"
                        key={"commitday" + day}
                        onClick={e => {
                            e.stopPropagation();
                            pxt.tickEvent("github.history.selectday");
                            this.setState({ selectedDay: selectedDay === day ? undefined : day, selectedCommit: undefined });
                        }}
                        onKeyDown={fireClickOnEnter}>
                        <div className="content">
                            <div className="ui header">{day}
                                <div className="ui label button">
                                    <i className="long arrow alternate up icon"></i> {days[day].length}
                                </div>
                            </div>
                            {day === selectedDay &&
                                <div className="ui divided items">
                                    {days[day].map(commit => <CommitView
                                        key={'commit' + commit.sha}
                                        onClick={e => {
                                            e.stopPropagation();
                                            pxt.tickEvent("github.history.selectcommit", undefined, { interactiveConsent: true })
                                            const { selectedCommit } = this.state;
                                            this.setState({ selectedCommit: commit == selectedCommit ? undefined : commit })
                                        }}
                                        commit={commit}
                                        parent={parent}
                                        githubId={githubId}
                                        expanded={selectedCommit === commit}
                                    />)}
                                </div>}
                        </div>
                    </div>)}
            </div>}
        </div>
    }
}

export class Editor extends srceditor.Editor {
    private view: GithubComponent;

    constructor(public parent: pxt.editor.IProjectView) {
        super(parent)
        this.handleViewRef = this.handleViewRef.bind(this);
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

    hasHistory() { return true; }

    hasEditorToolbar() {
        return false
    }

    setVisible(b: boolean) {
        this.isVisible = b;
        if (this.view) this.view.setVisible(b);
    }

    setHighContrast(hc: boolean) {
    }

    acceptsFile(file: pkg.File) {
        return file.name === pxt.github.GIT_JSON;
    }

    loadFileAsync(file: pkg.File, hc?: boolean): Promise<void> {
        // force refresh to ensure we have a view
        return super.loadFileAsync(file, hc)
            .then(() => compiler.getBlocksAsync()) // make sure to load block definitions
            .then(() => this.parent.forceUpdate());
    }

    handleViewRef = (c: GithubComponent) => {
        this.view = c;
        if (this.view)
            this.view.setVisible(this.isVisible);
    }

    display() {
        if (!this.isVisible)
            return undefined;

        const header = this.parent.state.header;
        if (!header || !header.githubId) return undefined;

        return <GithubComponent ref={this.handleViewRef} parent={this.parent} />
    }
}
