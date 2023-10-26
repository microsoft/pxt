/* eslint-disable  jsx-a11y/anchor-is-valid */

import * as React from "react";
import * as sui from "./sui";
import * as core from "./core";
import * as coretsx from "./coretsx";
import * as pkg from "./package";
import * as cloudsync from "./cloudsync";
import * as workspace from "./workspace";

import Cloud = pxt.Cloud;
import Util = pxt.Util;
import { TimeMachine } from "./timeMachine";
import { fireClickOnEnter } from "./util";
import { pairAsync } from "./cmds";
import { invalidate } from "./data";

let dontShowDownloadFlag = false;

export function showAboutDialogAsync(projectView: pxt.editor.IProjectView) {
    const compileService = pxt.appTarget.compileService;
    const githubUrl = pxt.appTarget.appTheme.githubUrl;
    const targetTheme = pxt.appTarget.appTheme;
    const versions: pxt.TargetVersions = pxt.appTarget.versions;
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

    const compileVariantInfos = (pxt.appTarget.multiVariants?.map(
        variantName => {
            const compileService = pxt.U.clone(pxt.appTarget.compileService);
            const variant = pxt.appTarget.variants[variantName];
            if (variant?.compileService)
                pxt.U.jsonCopyFrom(compileService, variant.compileService);
            return { variantName, compileService };
        }
    ) || [{
        variantName: "",
        compileService: pxt.appTarget.compileService
    }])
        .filter(info => info.compileService && info.compileService.githubCorePackage && info.compileService.gittag && info.compileService.serviceId);

    pxt.targetConfigAsync()
        .then(config => {
            const isPxtElectron = pxt.BrowserUtils.isPxtElectron();
            const latestElectronRelease = config?.electronManifest?.latest;
            return core.confirmAsync({
                header: lf("About"),
                hasCloseIcon: true,
                agreeLbl: lf("Ok"),
                agreeClass: "positive",
                buttons,
                jsx: <div>
                    {isPxtElectron ?
                        (!pxt.Cloud.isOnline() || !latestElectronRelease)
                            ? <p>{lf("Please connect to internet to check for updates")}</p>
                            : pxt.semver.strcmp(pxt.appTarget.versions.target, latestElectronRelease) < 0
                                ? <a target="_blank" rel="noopener noreferrer" href="/offline-app">{lf("An update {0} for {1} is available", latestElectronRelease, pxt.appTarget.title)}</a>
                                : <p>{lf("{0} is up to date", pxt.appTarget.title)}</p>
                        : undefined}
                    {githubUrl && versions && renderVersionLink(pxt.appTarget.name, versions.target, `${githubUrl}/releases/tag/v${versions.target}`)}
                    {versions && renderVersionLink("Microsoft MakeCode", versions.pxt, `https://github.com/Microsoft/pxt/releases/tag/v${versions.pxt}`)}
                    {compileVariantInfos?.length ? compileVariantInfos.map(info => <div key={info.variantName}>{renderCompileLink(info.variantName, info.compileService)}</div>) : undefined}
                    <p><br /></p>
                    <p>
                        {targetTheme.termsOfUseUrl ? <a target="_blank" className="item" href={targetTheme.termsOfUseUrl} rel="noopener noreferrer">{lf("Terms of Use")}</a> : undefined}
                        &nbsp;&nbsp;&nbsp; {targetTheme.privacyUrl ? <a target="_blank" className="item" href={targetTheme.privacyUrl} rel="noopener noreferrer">{lf("Privacy")}</a> : undefined}
                    </p>
                    {targetTheme.copyrightText ? <p> {targetTheme.copyrightText} </p> : undefined}
                </div>
            })
        });
}


function renderCompileLink(variantName: string, cs: pxt.TargetCompileService) {
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
            aria-label={`${lf("{0} version{1}", name, version)}`}
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

export class ProgressBar extends React.Component<ProgressBarProps, {}> {
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
                    <sui.Input type="url" autoFocus value={repoName} onChange={onNameChanged}
                        label={lf("Repository name")} id="githubRepoNameInput"
                        placeholder={`pxt-my-gadget...`} class="fluid" error={nameErr} />
                </div>
                <div className="ui field">
                    <sui.Input type="text" value={repoDescription} onChange={onDescriptionChanged}
                        label={lf("Repository description")} id="githubRepoDescriptionInput"
                        placeholder={lf("MakeCode extension for my gadget")} class="fluid" />
                </div>
                <div className="ui field">
                    <select className={`ui dropdown`} onChange={onPublicChanged} aria-label={lf("Repository visibility setting")}>
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
                        return pxt.github.normalizeRepoId("https://github.com/" + r.fullName, "master");
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
    return cloudsync.githubProvider(true).routedLoginAsync(`import`)
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
                    res = pxt.github.normalizeRepoId("https://github.com/" + r.fullName, r.defaultBranch)
                    core.hideDialog()
                },
            }));
            return core.confirmAsync({
                header: lf("Clone or create your own GitHub repo"),
                hideAgree: true,
                hasCloseIcon: true,
                jsx: <div className="ui form">
                    <div className="ui relaxed divided list">
                        <div key={"create new"} className="item">
                            <i className="large plus circle middle aligned icon"></i>
                            <div className="content">
                                <a onClick={createNew} role="button" className="header"
                                    tabIndex={0} onKeyDown={fireClickOnEnter}
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
                                    <a onClick={r.onClick} role="button" className="header"
                                        tabIndex={0} onKeyDown={fireClickOnEnter}
                                    >{r.name}</a>
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
        core.confirmAsync({
            header: lf("Is this content inappropriate?"),
            hasCloseIcon: true,
            agreeLbl: lf("Report"),
            disagreeLbl: lf("Cancel"),
            jsx: <div className="ui form">
                <div className="ui field">
                    <p>{lf("This content was written by an independent user and may be inappropriate or abusive. Help us block or filter that content by reporting it to Github.")}</p>
                </div>
                <div className="ui field">
                    <label id="githubContentUrlLabel">{lf("Content URL")}</label>
                    <sui.Input type="url" aria-labelledby="githubContentUrlLabel" readOnly lines={1} copy={true} autoFocus={!pxt.BrowserUtils.isMobile()} selectOnClick={true} value={pubId}></sui.Input>
                </div>
            </div>,
        }).then(res => {
            if (res) {
                window.open("https://github.com/contact/report-content", "_blank");
            }
        });
        return;
    }

    // shared script id section
    let urlInput: HTMLInputElement;
    let reasonInput: HTMLTextAreaElement;
    const shareUrl = pxt.appTarget.appTheme.shareUrl || "https://makecode.com/";
    core.confirmAsync({
        header: lf("Report Abuse"),
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
    }).then(res => {
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
    });
}

export function renderBrowserDownloadInstructions(saveonly?: boolean, redeploy?: () => Promise<void>) {
    const boardName = pxt.appTarget.appTheme.boardName || lf("device");
    const boardDriveName = pxt.appTarget.appTheme.driveDisplayName || pxt.appTarget.compile.driveName || "???";
    const fileExtension = pxt.appTarget.compile?.useUF2 ? ".uf2" : ".hex";
    const webUSBSupported = pxt.usb.isEnabled && pxt.appTarget?.compile?.webUSB;

    const onPairClicked = async () => {
        core.hideDialog();
        const successfulPairing = await pairAsync(true);
        if (redeploy && successfulPairing)
            await redeploy();
    }

    const onCheckboxClicked = (value: boolean) => {
        const valueString = "" + value;
        pxt.tickEvent("downloaddialog.dontshowagain", { checked: valueString });

        dontShowDownloadFlag = value;
    }

    const image = pxt.appTarget.appTheme.downloadDialogTheme?.dragFileImage;
    const columns = image ? "two" : "one";

    return <div className="ui grid stackable upload">
        <div className="column sixteen wide instructions">
            <div className="ui grid">
                <div className="row">
                    <div className="column">
                        <div className={`ui ${columns} column grid padded`}>
                            <div className="column">
                                <div className="ui">
                                    <div className="content">
                                        <div className="description">
                                            {lf("Your code is being downloaded as a {1} file. You can drag this file to your {0} using your computer's file explorer.", boardName, fileExtension)}
                                        </div>
                                        {webUSBSupported &&
                                            <div className="download-callout">
                                                <label className="ui purple ribbon label">{lf("Want faster downloads?")}</label>
                                                <div className="ui two column grid content">
                                                    <div className="icon-align three wide column">
                                                        <div />
                                                        <i className="icon big usb" />
                                                        <div />
                                                    </div>
                                                    <div className="thirteen wide column">
                                                        {lf("Download your code faster by pairing with WebUSB!")}
                                                        <a className="ui button purple" onClick={onPairClicked}>{lf("Pair Now")}</a>
                                                    </div>
                                                </div>
                                            </div>
                                        }
                                    </div>
                                </div>
                            </div>
                            {image &&
                                <div className="column">
                                    <div className="ui">
                                        <div className="image">
                                            <img alt={lf("Comic moving {1} file to {0}", boardDriveName, fileExtension)} className="ui medium rounded image" src={image} />
                                        </div>
                                    </div>
                                </div>
                            }
                        </div>
                    </div>
                </div>
            </div>
            <div>
                {!saveonly &&
                    <sui.Checkbox
                        inputLabel={lf("Don't show this again")}
                        onChange={onCheckboxClicked}
                    />
                }
            </div>
        </div>
    </div>;
}

export function renderIncompatibleHardwareDialog() {
    const boardName = pxt.appTarget.appTheme.boardName || lf("device");
    const bodyText = lf("Oops! Looks like your project has code that won't run on the hardware you have connected. Would you like to download anyway?");
    const helpText = lf("Learn more about what's supported by your hardware…")
    const helpURL = pxt.appTarget.appTheme.downloadDialogTheme?.incompatibleHardwareHelpURL;
    const imageURL = pxt.appTarget.appTheme.downloadDialogTheme?.incompatibleHardwareImage;
    const columns = imageURL ? "two" : "one";

    return <div className={`ui ${columns} column grid padded download-dialog`}>
        <div className="column">
            <div className="ui">
                <div className="content">
                    <div className="description">
                        {bodyText}
                        <br />
                        {helpURL && <a target="_blank" rel="noopener noreferrer" href={helpURL}>{helpText}</a>}
                    </div>
                </div>
            </div>
        </div>
        {imageURL &&
            <div className="column">
                <div className="ui">
                    <div className="image download-dialog-image">
                        <img alt={lf("Image of {0}", boardName)} className="ui medium rounded image" src={imageURL} />
                    </div>
                </div>
            </div>
        }
    </div>
}

export function clearDontShowDownloadDialogFlag() {
    dontShowDownloadFlag = false;
}

export function isDontShowDownloadDialogFlagSet() {
    return dontShowDownloadFlag;
}

export async function showTurnBackTimeDialogAsync(header: pxt.workspace.Header, reloadHeader: () => void) {
    const text = await workspace.getTextAsync(header.id, true);
    let history: pxt.workspace.HistoryFile;

    if (text?.[pxt.HISTORY_FILE]) {
        history = pxt.workspace.parseHistoryFile(text[pxt.HISTORY_FILE]);
    }

    const loadProject = async (text: pxt.workspace.ScriptText, editorVersion: string) => {
        core.hideDialog();

        header.targetVersion = editorVersion;

        await workspace.saveSnapshotAsync(header.id);
        await workspace.saveAsync(header, text);
        reloadHeader();
    }

    const copyProject = async (text: pxt.workspace.ScriptText, editorVersion: string, timestamp?: number) => {
        core.hideDialog();

        let newHistory = history

        if (timestamp != undefined) {
            newHistory = {
                entries:  history.entries.slice(0, history.entries.findIndex(e => e.timestamp === timestamp)),
                snapshots: history.snapshots.filter(s => s.timestamp <= timestamp),
                shares: history.shares.filter(s => s.timestamp <= timestamp)
            }
        }

        if (text[pxt.HISTORY_FILE]) {
            text[pxt.HISTORY_FILE] = JSON.stringify(newHistory);
        }
        const date = new Date(timestamp);

        const dateString = date.toLocaleDateString(
            pxt.U.userLanguage(),
            {
                year: "numeric",
                month: "numeric",
                day: "numeric"
            }
        );

        const timeString = date.toLocaleTimeString(
            pxt.U.userLanguage(),
            {
                timeStyle: "short"
            } as any
        );

        const newHeader: pxt.workspace.Header = {
            ...header,
            targetVersion: editorVersion
        }

        await workspace.duplicateAsync(newHeader, `${newHeader.name} ${dateString} ${timeString}`, text);

        invalidate("headers:");

        core.infoNotification(lf("Project copy saved to My Projects"))
    }

    await core.dialogAsync({
        header: lf("Turn back time"),
        className: "time-machine-dialog",
        size: "fullscreen",
        hasCloseIcon: true,
        jsx: (
            <TimeMachine
                history={history}
                text={text}
                onProjectLoad={loadProject}
                onProjectCopy={copyProject}
            />
        )
    })
}