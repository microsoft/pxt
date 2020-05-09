// tslint:disable: react-a11y-anchors

import * as React from "react";
import * as sui from "./sui";
import * as core from "./core";
import * as coretsx from "./coretsx";
import * as pkg from "./package";
import * as cloudsync from "./cloudsync";

import Cloud = pxt.Cloud;
import Util = pxt.Util;

export function showAboutDialogAsync(projectView: pxt.editor.IProjectView) {
    const compileService = pxt.appTarget.compileService;
    const githubUrl = pxt.appTarget.appTheme.githubUrl;
    const targetTheme = pxt.appTarget.appTheme;
    const versions: pxt.TargetVersions = pxt.appTarget.versions;
    const showCompile = compileService && compileService.githubCorePackage && compileService.gittag && compileService.serviceId;

    const buttons: sui.ModalButton[] = [];
    if (targetTheme.experiments)
        buttons.push({
            label: lf("Experiments"),
            className: "secondary",
            onclick: () => {
                core.hideDialog();
                pxt.tickEvent("about.experiments", undefined, { interactiveConsent: true });
                projectView.showExperimentsDialog();
            }
        })

    pxt.targetConfigAsync()
        .then(config => {
            const isPxtElectron = pxt.BrowserUtils.isPxtElectron();
            const electronManifest = config && config.electronManifest;
            return core.confirmAsync({
                header: lf("About"),
                hideCancel: true,
                hasCloseIcon: true,
                agreeLbl: lf("Ok"),
                agreeClass: "positive",
                buttons,
                jsx: <div>
                    {isPxtElectron ?
                        (!pxt.Cloud.isOnline() || !electronManifest)
                            ? <p>{lf("Please connect to internet to check for updates")}</p>
                            : pxt.semver.strcmp(pxt.appTarget.versions.target, electronManifest.latest) < 0
                                ? <a target="_blank" rel="noopener noreferrer" href="/offline-app">{lf("An update {0} for {1} is available", electronManifest.latest, pxt.appTarget.title)}</a>
                                : <p>{lf("{0} is up to date", pxt.appTarget.title)}</p>
                        : undefined}
                    {githubUrl && versions ?
                        renderVersionLink(pxt.appTarget.name, versions.target, `${githubUrl}/releases/tag/v${versions.target}`)
                        : undefined}
                    {versions ?
                        renderVersionLink("Microsoft MakeCode", versions.pxt, `https://github.com/Microsoft/pxt/releases/tag/v${versions.pxt}`)
                        : undefined}
                    {showCompile ?
                        renderCompileLink(compileService)
                        : undefined}
                    <p><br /></p>
                    <p>
                        {targetTheme.termsOfUseUrl ? <a target="_blank" className="item" href={targetTheme.termsOfUseUrl} rel="noopener noreferrer">{lf("Terms of Use")}</a> : undefined}
                        &nbsp;&nbsp;&nbsp; {targetTheme.privacyUrl ? <a target="_blank" className="item" href={targetTheme.privacyUrl} rel="noopener noreferrer">{lf("Privacy")}</a> : undefined}
                    </p>
                    {targetTheme.copyrightText ? <p> {targetTheme.copyrightText} </p> : undefined}
                </div>
            })
        }).done();
}


function renderCompileLink(cs: pxt.TargetCompileService) {
    let url: string;
    let version: string;
    let name: string;

    if (typeof cs.codalTarget === "object" && typeof cs.codalTarget.url === "string") {
        url = cs.codalTarget.branch ? pxt.BrowserUtils.joinURLs(cs.codalTarget.url, "releases/tag", cs.codalTarget.branch) : cs.codalTarget.url;
        version = cs.codalTarget.branch || "master";
        name = cs.codalTarget.name || cs.serviceId;
    }
    else {
        url = `https://github.com/${cs.githubCorePackage}/releases/tag/${cs.gittag}`;
        version = cs.gittag;
        name = cs.serviceId;
    }

    return renderVersionLink(lf("{0} runtime", name), version, url);
}

function renderVersionLink(name: string, version: string, url: string) {
    return <p>{lf("{0} version:", name)} &nbsp;
            <a href={encodeURI(url)}
            title={`${lf("{0} version: {1}", name, version)}`}
            target="_blank" rel="noopener noreferrer">{version}</a>
    </p>;
}

export function showPackageErrorDialogAsync(badPackages: pkg.EditorPackage[], updatePackages: (packages: pkg.EditorPackage[], token: Util.CancellationToken) => Promise<boolean>, openLegacyEditor?: () => void) {
    let projectOpen = false;
    let onProjectOpen = () => projectOpen = true;

    const token = new Util.CancellationToken();
    const loaderId = "package-update-cancel";

    pxt.tickEvent("update.extensionErrorsShown")

    return core.dialogAsync({
        header: lf("Extension Errors"),
        hasCloseIcon: true,
        hideCancel: true,
        jsx: <div className="wizard-wrapper">
            <ExtensionErrorWizard
                openLegacyEditor={openLegacyEditor}
                affectedPackages={badPackages}
                updatePackages={updatePackages}
                onProjectOpen={onProjectOpen}
                token={token} />
        </div>
    })
        .then(() => {
            if (!projectOpen) {
                core.showLoading(loaderId, lf("Stopping update..."))
                return token.cancelAsync();
            }
            return Promise.resolve();
        })
        .then(() => {
            core.hideLoading(loaderId)
            return projectOpen;
        });
}

interface ExtensionErrorWizardProps {
    affectedPackages: pkg.EditorPackage[];
    updatePackages: (packages: pkg.EditorPackage[], token: Util.CancellationToken) => Promise<boolean>;
    openLegacyEditor?: () => void;
    onProjectOpen: () => void;
    token: Util.CancellationToken;
}

interface ExtensionErrorWizardState {
    updating: boolean;
    showProgressBar: boolean;
    packagesUpdated: number;
    updateComplete: boolean;
    updateError?: boolean;
}

class ExtensionErrorWizard extends React.Component<ExtensionErrorWizardProps, ExtensionErrorWizardState> {
    constructor(props: ExtensionErrorWizardProps) {
        super(props);
        this.state = {
            updating: false,
            showProgressBar: false,
            updateComplete: false,
            packagesUpdated: 0
        };
        this.startUpdate = this.startUpdate.bind(this);
        this.openProject = this.openProject.bind(this);
        this.openLegacyEditor = this.openLegacyEditor.bind(this);
    }

    startUpdate() {
        if (this.state.updating) return;

        pxt.tickEvent("update.startExtensionUpdate")
        const startTime = Date.now();

        this.setState({
            updating: true
        });

        setTimeout(() => {
            if (this.props.token.isCancelled()) return;
            // Switch to progress bar if the update is taking a long time
            if (this.state.updating && this.props.affectedPackages.length > 1) {
                this.setState({
                    showProgressBar: true
                });
            }
        }, 3000)

        const pkgs = this.props.affectedPackages;
        this.props.token.onProgress(completed => {
            this.setState({ packagesUpdated: completed });
        });

        this.props.updatePackages(pkgs, this.props.token)
            .then(success => {
                if (this.props.token.isCancelled()) return;

                pxt.tickEvent("update.endExtensionUpdate", {
                    success: "" + success,
                    duration: Date.now() - startTime
                });

                if (!success) {
                    this.setState({
                        updateError: true,
                        updating: false
                    });
                }
                else {
                    this.setState({
                        updating: false,
                        updateComplete: true
                    });

                    setTimeout(() => {
                        if (this.props.token.isCancelled()) return;
                        this.openProject(true);
                    }, 1500);
                }
            })
    }

    openProject(quiet = false) {
        if (!quiet) pxt.tickEvent("update.ignoredExtensionErrors");

        this.props.onProjectOpen();
        coretsx.hideDialog();
    }

    openLegacyEditor() {
        this.props.onProjectOpen();
        this.props.openLegacyEditor();
    }

    protected buildActionList() {
        const actions: { text: string, title: string, callback: () => void }[] = [];

        if (!this.state.updateError) {
            actions.push({
                text: lf("Try to fix"),
                title: lf("Update all extensions in the project to their latest versions"),
                callback: this.startUpdate
            });
        }

        actions.push({
            text: lf("Ignore errors and open"),
            title: lf("Ignore errors and open"),
            callback: this.openProject
        });

        if (this.props.openLegacyEditor) {
            actions.push({
                text: lf("Go to the old editor"),
                title: lf("Open this project in the editor where it was created"),
                callback: this.openLegacyEditor
            });
        }

        return actions;
    }

    render() {
        const { affectedPackages } = this.props;
        const { updating, updateComplete, packagesUpdated, updateError, showProgressBar } = this.state;

        if (updating) {
            const progressString = packagesUpdated === affectedPackages.length ? lf("Finishing up...") :
                lf("Updating extension {0} of {1}...", packagesUpdated + 1, affectedPackages.length);

            return <div>
                {showProgressBar ?
                    <ProgressBar percentage={100 * (packagesUpdated / affectedPackages.length)} label={progressString} /> :
                    <div className="ui centered inline inverted text loader">
                        {progressString}
                    </div>
                }
            </div>
        }
        else if (updateComplete) {
            return <div>
                <h2 className="ui center aligned icon header">
                    <i className="green check circle outline icon"></i>
                    {lf("Update complete")}
                </h2>
            </div>
        }

        const message = updateError ? lf("Looks like updating didn't fix the issue. How would you like to proceed?") :
            lf("Looks like there are some errors in the extensions added to this project. How would you like to proceed?");

        return <div>
            <p>{message}</p>
            <WizardMenu actions={this.buildActionList()} />
        </div>
    }
}

interface ProgressBarProps {
    percentage: number
    label?: string;
    cornerRadius?: number;
}

class ProgressBar extends React.Component<ProgressBarProps, {}> {
    render() {
        let { percentage, label, cornerRadius } = this.props;

        cornerRadius = (cornerRadius == null ? 3 : Math.max(cornerRadius, 0));
        percentage = Math.max(Math.min(percentage, 100), 2);

        return <div>
            <div className="progress-bar-container">
                <svg className="progress-bar" width="100%" height="100%">
                    <rect className="progress-bar-bg" width="100%" height="100%" rx={cornerRadius} ry={cornerRadius} />
                    <rect className="progress-bar-content" width={percentage.toString() + "%"} height="100%" rx={cornerRadius} ry={cornerRadius} />
                </svg>
            </div>
            {label ? <p className="progress-bar-label">{label}</p> : undefined}
        </div>
    }
}

interface WizardMenuProps {
    actions: { text: string, title: string, callback: () => void }[];
}

class WizardMenu extends sui.StatelessUIElement<WizardMenuProps> {
    render() {
        return <div className="ui relaxed list" role="menu">
            {this.props.actions.map(({ text, title, callback }, i) =>
                <div className="item wizard-action" aria-label={title} title={title} onClick={callback} role="menuitem" key={i}>
                    <span className="left floated"><i className="medium arrow right icon"></i></span>
                    <sui.Link>{text}</sui.Link>
                </div>)
            }
        </div>
    }
}

export function showPRDialogAsync(repo: string, prURL: string): Promise<void> {
    return core.confirmAsync({
        header: lf("Commit conflict in {0}", repo),
        agreeLbl: lf("Resolve conflict"),
        disagreeLbl: lf("I'm done!"),
        body: lf("The latest online version of {0} contains edits conflicting with yours. We have created a pull request (PR) that you can use to resolve the conflicts. Once you're done, sync to get all merged changes. In the meantime we have taken you to the latest online version of {0}.", repo),
    }).then(res => {
        if (res) {
            pxt.tickEvent("app.commit.pr");
            window.open(prURL, "_blank")
            // wait for the user to click "I'm done"
            return showPRDialogAsync(repo, prURL)
        }
        return Promise.resolve()
    })
}

export function showImportUrlDialogAsync() {
    let input: HTMLInputElement;
    const shareUrl = pxt.appTarget.appTheme.shareUrl || "https://makecode.com/";

    return core.confirmAsync({
        header: lf("Open project URL"),
        hasCloseIcon: true,
        hideCancel: true,
        onLoaded: (el) => {
            input = el.querySelector('input');
            input.onkeydown = ev => {
                if (ev.key === "Enter") {
                    const confirm = el.querySelector('.button.approve') as HTMLButtonElement;
                    confirm?.click();
                }
            }
        },
        jsx: <div className="ui form">
            <div className="ui icon violet message">
                <i className="user icon" aria-hidden={true}></i>
                <div className="content">
                    <h3 className="header">
                        {lf("User-provided content")}
                    </h3>
                    <p>
                        {lf("The content below is provided by a user, and is not endorsed by Microsoft.")}
                        <br />
                        {lf("If you think it's not appropriate, please report abuse through Settings -> Report Abuse.")}
                    </p>
                </div>
            </div>
            <div className="ui field">
                <label id="selectUrlToOpenLabel">{lf("Copy the URL of the project.")}</label>
                <input type="url" tabIndex={0} autoFocus aria-labelledby="selectUrlToOpenLabel" placeholder={lf("{0} or {1}...", shareUrl, "https://github.com/...")} className="ui blue fluid"></input>
            </div>
        </div>,
    }).then(res => {
        if (res) {
            pxt.tickEvent("app.open.url");
            const url = input.value;
            let projectId = pxt.github.normalizeRepoId(url);
            if (!projectId)
                projectId = pxt.Cloud.parseScriptId(url);
            if (!projectId) {
                return Promise.reject(new Error(lf("Sorry, the project url looks invalid.")));
            }

            return Promise.resolve(projectId);
        }

        // Cancelled
        return Promise.resolve(undefined);
    })
}

export function showGithubTokenError(err: any) {
    if (err.statusCode == 401) {
        core.errorNotification(lf("GitHub didn't accept token"))
        return true
    } else if (err.statusCode == 404) {
        core.errorNotification(lf("Token has neither '{0}' nor '{1}' scope", "repo", "public_repo"))
        return true
    } else {
        return false
    }
}

export function showCreateGithubRepoDialogAsync(name?: string) {
    pxt.tickEvent("github.create.dialog");
    if (name) {
        name = name.toLocaleLowerCase().replace(/\s+/g, '-');
        name = name.replace(/[^\w\-]/g, '');
    }

    let repoName: string = name || "";
    let repoDescription: string = "";
    let repoPublic: boolean = true;

    function repoNameError(): string {
        if (repoName == "pxt-" + lf("Untitled").toLocaleLowerCase()
            || repoName == "pxt-untitled")
            return lf("Please pick a different name.")
        const repoNameRx = /^[\w\-]{1,64}$/;
        if (!repoNameRx.test(repoName))
            return lf("Repository names must be less than 64 characters and cannot include spaces or special characters.");
        return undefined;
    }

    function onNameChanged(v: string) {
        v = v.trim();
        if (repoName != v) {
            repoName = v;
            coretsx.forceUpdate();
        }
    }

    function onDescriptionChanged(v: string) {
        if (repoDescription != v) {
            repoDescription = v;
            coretsx.forceUpdate();
        }
    }

    function onPublicChanged(e: React.ChangeEvent<HTMLSelectElement>) {
        const v = e.currentTarget.selectedIndex == 0;
        if (repoPublic != v) {
            repoPublic = v;
            coretsx.forceUpdate();
        }
    }

    return core.confirmAsync({
        hideCancel: true,
        hasCloseIcon: true,
        header: lf("Create GitHub repository"),
        jsxd: () => {
            const nameErr = repoNameError();
            return <div className={`ui form`}>
                <p>
                    {lf("Host your code on GitHub and work together with friends.")}
                    {sui.helpIconLink("/github", lf("Learn more about GitHub"))}
                </p>
                <div className="ui field">
                    <sui.Input type="url" autoFocus value={repoName} onChange={onNameChanged} label={lf("Repository name")} placeholder={`pxt-my-gadget...`} class="fluid" error={nameErr} />
                </div>
                <div className="ui field">
                    <sui.Input type="text" value={repoDescription} onChange={onDescriptionChanged} label={lf("Repository description")} placeholder={lf("MakeCode extension for my gadget")} class="fluid" />
                </div>
                <div className="ui field">
                    <select className={`ui dropdown`} onChange={onPublicChanged}>
                        <option aria-selected={repoPublic} value="true">{lf("Public repository, anyone can look at your code.")}</option>
                        <option aria-selected={!repoPublic} value="false">{lf("Private repository, your code is only visible to you.")}</option>
                    </select>
                </div>
            </div>
        },
    }).then(res => {
        if (!res)
            pxt.tickEvent("github.create.cancel");
        else {
            if (!repoNameError()) {
                repoDescription = repoDescription || lf("A MakeCode project")
                core.showLoading("creategithub", lf("creating {0} repository...", repoName))
                return pxt.github.createRepoAsync(repoName, repoDescription.trim(), !repoPublic)
                    .finally(() => core.hideLoading("creategithub"))
                    .then(r => {
                        pxt.tickEvent("github.create.ok");
                        return pxt.github.normalizeRepoId("https://github.com/" + r.fullName);
                    }, err => {
                        if (!showGithubTokenError(err)) {
                            if (err.statusCode == 422)
                                core.errorNotification(lf("Repository '{0}' already exists.", repoName))
                            else
                                core.errorNotification(err.message)
                            pxt.tickEvent("github.create.error", { statusCode: err.statusCode });
                        }
                        return "";
                    })
            } else {
                core.errorNotification(lf("Invalid repository name."))
                pxt.tickEvent("github.create.invalidname");
            }
        }
        return "";
    })
}

export function showImportGithubDialogAsync() {
    let res = ""
    let createNew = () => {
        res = "NEW"
        core.hideDialog()
    }
    core.showLoading("githublist", lf("searching GitHub repositories..."))
    return cloudsync.githubProvider().routedLoginAsync(`import`)
        .then(r => r && r.accessToken && pxt.github.listUserReposAsync())
        .finally(() => core.hideLoading("githublist"))
        .then(repos => {
            if (!repos)
                return Promise.resolve(-1);
            const repoInfo = repos.map(r => ({
                name: r.fullName,
                description: r.description,
                updatedAt: r.updatedAt,
                onClick: () => {
                    res = pxt.github.normalizeRepoId("https://github.com/" + r.fullName)
                    core.hideDialog()
                },
            }));
            return core.confirmAsync({
                header: lf("Clone or create your own GitHub repo"),
                hideAgree: true,
                hideCancel: true,
                hasCloseIcon: true,
                /* tslint:disable:react-a11y-anchors */
                jsx: <div className="ui form">
                    <div className="ui relaxed divided list" role="menu">
                        <div key={"create new"} className="item">
                            <i className="large plus circle middle aligned icon"></i>
                            <div className="content">
                                <a onClick={createNew} role="menuitem" className="header"
                                    title={lf("Create new GitHub repository")}>
                                    <b>{lf("Create new...")}</b>
                                </a>
                                <div className="description">
                                    {lf("Create a new GitHub repo in your account.")}
                                </div>
                            </div>
                        </div>
                        {repoInfo.map(r =>
                            <div key={r.name} className="item">
                                <i className="large github middle aligned icon"></i>
                                <div className="content">
                                    <a onClick={r.onClick} role="menuitem" className="header">{r.name}</a>
                                    <div className="description">
                                        {pxt.Util.timeSince(r.updatedAt)}
                                        {". "}
                                        {r.description}
                                    </div>
                                </div>
                            </div>)}
                    </div>

                    <div className="ui icon green message">
                        <i className="info circle icon"></i>
                        <div className="content">
                            <h3 className="header">
                                {lf("Not finding what you're looking for?")}
                            </h3>
                            <p>
                                {lf("Use the 'Import URL' option in the previous dialog to import repo by exact URL.")}
                            </p>
                        </div>
                    </div>
                </div>,
            })
        }).then(() => res)
}

export function showImportFileDialogAsync(options?: pxt.editor.ImportFileOptions) {
    let input: HTMLInputElement;
    let exts = [pxt.appTarget.compile.saveAsPNG ? ".png" : ".mkcd"];
    if (pxt.appTarget.compile.hasHex) {
        exts.push(".hex");
    }
    if (pxt.appTarget.compile.useUF2) {
        exts.push(".uf2");
    }
    return core.confirmAsync({
        header: lf("Open {0} file", exts.join(lf(" or "))),
        hasCloseIcon: true,
        hideCancel: true,
        onLoaded: (el) => {
            input = el.querySelectorAll('input')[0] as HTMLInputElement;
        },
        jsx: <div className="ui form">
            <div className="ui field">
                <label id="selectFileToOpenLabel">{lf("Select a {0} file to open.", exts.join(lf(" or ")))}</label>
                <input type="file" tabIndex={0} autoFocus aria-labelledby="selectFileToOpenLabel" className="ui blue fluid"></input>
            </div>
            <div className="ui secondary segment">
                {lf("You can import files by dragging and dropping them anywhere in the editor!")}
            </div>
        </div>,
    }).then(res => {
        if (res) {
            return input.files[0];
        }
        return undefined;
    })
}

export function showReportAbuseAsync(pubId?: string) {
    // send users to github directly for unwanted repoes
    const ghid = pxt.github.parseRepoId(pubId);
    if (ghid) {
        pxt.tickEvent("reportabuse.github");
        window.open("https://github.com/contact/report-content", "_blank");
        return;
    }

    // shared script id section
    let urlInput: HTMLInputElement;
    let reasonInput: HTMLTextAreaElement;
    const shareUrl = pxt.appTarget.appTheme.shareUrl || "https://makecode.com/";
    core.confirmAsync({
        header: lf("Report Abuse"),
        hideCancel: true,
        hasCloseIcon: true,
        onLoaded: (el) => {
            urlInput = el.querySelectorAll('input')[0] as HTMLInputElement;
            reasonInput = el.querySelectorAll('textarea')[0] as HTMLTextAreaElement;
            if (pubId)
                urlInput.value = shareUrl + pubId;
        },
        agreeLbl: lf("Submit"),
        jsx: <div className="ui form">
            <div className="ui field">
                <label id="abuseUrlLabel">{lf("What is the URL of the offensive project?")}</label>
                <input type="url" aria-labelledby="abuseUrlLabel" tabIndex={0} autoFocus placeholder="Enter project URL here..."></input>
            </div>
            <div className="ui field">
                <label id="abuseDescriptionLabel">{lf("Why do you find it offensive?")}</label>
                <textarea aria-labelledby="abuseDescriptionLabel"></textarea>
            </div>
        </div>,
    }).done(res => {
        if (res) {
            pxt.tickEvent("app.reportabuse.send");
            const id = pxt.Cloud.parseScriptId(urlInput.value as string);
            if (!id) {
                core.errorNotification(lf("Sorry, the project url looks invalid."));
            } else {
                core.infoNotification(lf("Sending abuse report..."));
                Cloud.privatePostAsync(`${id}/abusereports`, {
                    text: reasonInput.value
                })
                    .then(res => {
                        core.infoNotification(lf("Report sent. Thank you!"))
                    })
                    .catch(e => {
                        if (e.statusCode == 404)
                            core.warningNotification(lf("Oops, we could not find this script."))
                        else
                            core.handleNetworkError(e)
                    });
            }
        }
    })
}

export function showResetDialogAsync() {
    return core.confirmAsync({
        header: lf("Reset"),
        body: lf("You are about to clear all projects. Are you sure? This operation cannot be undone."),
        agreeLbl: lf("Reset"),
        agreeClass: "red",
        agreeIcon: "sign out",
        disagreeLbl: lf("Cancel")
    })
}

export function promptTranslateBlock(blockid: string, blockTranslationIds: string[]) {
    core.confirmAsync({
        header: lf("Translate this block"),
        hideCancel: true,
        hideAgree: true,
        hasCloseIcon: true,
        helpUrl: "/translate",
        jsx: <div>
            <div>
                {lf("Update the block translation below.")}
                {lf("Do not translate variable names (%name, $name).")}
                {lf("Once validated in Crowdin, translations may take 24h to be active.")}
            </div>
            {blockTranslationIds.map(trid => <div key={`ictr${trid}`} className="ui basic segment">{trid}</div>)}
        </div>
    }).done();
}
