import * as React from "react";
import * as ReactDOM from "react-dom";

import * as sui from "./sui";
import * as data from "./data";
import * as core from "./core";

import Cloud = pxt.Cloud;


interface PlainCheckboxProps {
    label: string;
    onChange: (v: boolean) => void;
}

interface PlainCheckboxState {
    isChecked: boolean;
}

class PlainCheckbox extends data.Component<PlainCheckboxProps, PlainCheckboxState> {
    constructor(props: PlainCheckboxProps) {
        super(props);
        this.state = {
            isChecked: false
        }
        this.setCheckedBit = this.setCheckedBit.bind(this);
    }

    setCheckedBit() {
        let val = !this.state.isChecked
        this.props.onChange(val)
        this.setState({ isChecked: val })
    }

    renderCore() {
        return <sui.Checkbox
            inputLabel={this.props.label}
            checked={this.state.isChecked}
            onChange={this.setCheckedBit} />
    }
}

export function showAboutDialogAsync() {
    const compileService = pxt.appTarget.compileService;
    const description = pxt.appTarget.description || pxt.appTarget.title;
    const githubUrl = pxt.appTarget.appTheme.githubUrl;
    const targetTheme = pxt.appTarget.appTheme;
    const versions: pxt.TargetVersions = pxt.appTarget.versions;

    core.confirmAsync({
        header: lf("About"),
        hideCancel: true,
        agreeLbl: lf("Ok"),
        agreeClass: "positive",
        jsx: <div>
            {githubUrl && versions ?
                <p>
                    {lf("{0} version:", pxt.appTarget.name)} &nbsp;
                    <a href={encodeURI(`${githubUrl}/releases/tag/v${versions.target}`)}
                        title={`${lf("{0} version : {1}", pxt.appTarget.name, versions.target)}`}
                        target="_blank" rel="noopener noreferrer">{pxt.appTarget.versions.target}</a>
                </p> : undefined}
            {versions ?
                <p>{lf("{0} version:", "Microsoft MakeCode")} &nbsp;
                    <a href={encodeURI(`https://github.com/Microsoft/pxt/releases/tag/v${versions.pxt}`)}
                        title={`${lf("{0} version: {1}", "Microsoft MakeCode", versions.pxt)}`}
                        target="_blank" rel="noopener noreferrer">{versions.pxt}</a>
                </p> : undefined}
            <p><br /></p>
            <p>
                {targetTheme.termsOfUseUrl ? <a target="_blank" className="item" href={targetTheme.termsOfUseUrl} rel="noopener noreferrer">{lf("Terms of Use")}</a> : undefined}
                &nbsp;&nbsp;&nbsp; {targetTheme.privacyUrl ? <a target="_blank" className="item" href={targetTheme.privacyUrl} rel="noopener noreferrer">{lf("Privacy")}</a> : undefined}
            </p>
            {targetTheme.copyrightText ? <p> {targetTheme.copyrightText} </p> : undefined}
        </div>

    }).done();
}

export function showCommitDialogAsync(repo: string) {
    let input: HTMLInputElement;
    const deflMsg = lf("Updates.")
    let bump = false
    const setBump = (v: boolean) => {
        bump = !!v
    }
    return core.confirmAsync({
        header: lf("Commit to {0}", repo),
        agreeLbl: lf("Commit"),
        onLoaded: (el) => {
            input = el.querySelectorAll('input')[0] as HTMLInputElement;
        },
        jsx: <div className="ui form">
            <div className="ui field">
                <label id="selectUrlToOpenLabel">{lf("Describe your changes.")}</label>
                <input type="url" tabIndex={0} autoFocus aria-describedby="selectUrlToOpenLabel" placeholder={deflMsg} className="ui blue fluid"></input>
            </div>
            <div className="ui field">
                <PlainCheckbox
                    label={lf("Publish to users (bump)")}
                    onChange={setBump} />
            </div>
        </div>,
    }).then(res => {
        if (res) {
            pxt.tickEvent("app.commit.ok");
            return {
                msg: input.value || deflMsg,
                bump
            }
        }
        return undefined;
    })
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
        onLoaded: (el) => {
            input = el.querySelectorAll('input')[0] as HTMLInputElement;
        },
        jsx: <div className="ui form">
            <div className="ui icon violet message">
                <i className="user icon"></i>
                <div className="content">
                    <h3 className="header">
                        {lf("User-provided content")}
                    </h3>
                    <p>
                        {lf("The content below is provided by a user, and is not endorsed by Microsoft.")}
                        {lf("If you think it's not appropriate, please report abuse through Settings -> Report Abuse.")}
                    </p>
                </div>
            </div>
            <div className="ui field">
                <label id="selectUrlToOpenLabel">{lf("Copy the URL of the project.")}</label>
                <input type="url" tabIndex={0} autoFocus aria-describedby="selectUrlToOpenLabel" placeholder={lf("{0} or {1}...", shareUrl, "https://github.com/...")} className="ui blue fluid"></input>
            </div>
        </div>,
    }).then(res => {
        if (res) {
            pxt.tickEvent("app.open.url");
            const url = input.value
            if (/^(github:|https:\/\/github.com\/)/.test(url))
                return pxt.github.noramlizeRepoId(url)
            return pxt.Cloud.parseScriptId(url);
        }
        return undefined;
    })
}


export function showCreateGithubRepoDialogAsync() {
    let inputName: HTMLInputElement;
    let inputDesc: HTMLInputElement;
    return core.confirmAsync({
        header: lf("Create GitHub repo"),
        onLoaded: (el) => {
            inputName = el.querySelectorAll('input')[0] as HTMLInputElement;
            inputDesc = el.querySelectorAll('input')[1] as HTMLInputElement;
        },
        jsx: <div className="ui form">
            <div className="ui field">
                <label id="selectUrlToOpenLabel">{lf("Repo name.")}</label>
                <input type="url" tabIndex={0} autoFocus aria-describedby="selectUrlToOpenLabel" placeholder={`pxt-my-gadget...`} className="ui fluid"></input>
            </div>
            <div className="ui field">
                <label id="selectDescToOpenLabel">{lf("Repo description.")}</label>
                <input type="url" tabIndex={0} autoFocus aria-describedby="selectDescToOpenLabel" placeholder={lf("MakeCode package for my gadget...")} className="ui fluid"></input>
            </div>
        </div>,
    }).then(res => {
        if (res) {
            pxt.tickEvent("app.github.create");
            const name = inputName.value.trim()
            const desc = inputDesc.value.trim()

            if (/^[\w\-]+$/.test(inputName.value)) {
                core.showLoading("creategithub", lf("Creating GitHub repo..."))
                return pxt.github.createRepoAsync(name, desc)
                    .finally(() => core.hideLoading("creategithub"))
                    .then(r => {
                        return pxt.github.noramlizeRepoId("https://github.com/" + r.fullName)
                    })
            } else {
                core.errorNotification(lf("Invalid repo name."))
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
    core.showLoading("githublist", lf("Getting repo list..."))
    return pxt.github.listUserReposAsync()
        .finally(() => core.hideLoading("githublist"))
        .then(repos => {
            let isPXT = (r: pxt.github.GitRepo) => /pxt|makecode/.test(r.name)
            return repos.filter(isPXT).concat(repos.filter(r => !isPXT(r)))
                .map(r => ({
                    name: r.fullName,
                    description: r.description,
                    updatedAt: r.updatedAt,
                    onClick: () => {
                        res = pxt.github.noramlizeRepoId("https://github.com/" + r.fullName)
                        core.hideDialog()
                    },
                }))
        })
        .then(repos => core.confirmAsync({
            header: lf("Clone or create your own GitHub repo"),
            hideAgree: true,
            /* tslint:disable:react-a11y-anchors */
            jsx: <div className="ui form">
                <div className="ui relaxed divided list">

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

                    {repos.map(r =>
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
                            {lf("Need some other repo?")}
                        </h3>
                        <p>
                            {lf("Use the 'Import URL' option in the previous dialog to import somebody's else repo.")}
                        </p>
                    </div>
                </div>
            </div>,
        })).then(() => res)
}

export function showImportFileDialogAsync() {
    let input: HTMLInputElement;
    let ext = ".mkcd";
    if (pxt.appTarget.compile.hasHex) {
        ext = ".hex";
    }
    if (pxt.appTarget.compile.useUF2) {
        ext = ".uf2";
    }
    if (pxt.appTarget.compile.saveAsPNG) {
        ext = ".png";
    }
    return core.confirmAsync({
        header: lf("Open {0} file", ext),
        onLoaded: (el) => {
            input = el.querySelectorAll('input')[0] as HTMLInputElement;
        },
        jsx: <div className="ui form">
            <div className="ui field">
                <label id="selectFileToOpenLabel">{lf("Select a {0} file to open.", ext)}</label>
                <input type="file" tabIndex={0} autoFocus aria-describedby="selectFileToOpenLabel" className="ui blue fluid"></input>
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
    let urlInput: HTMLInputElement;
    let reasonInput: HTMLTextAreaElement;
    const shareUrl = pxt.appTarget.appTheme.shareUrl || "https://makecode.com/";
    core.confirmAsync({
        header: lf("Report Abuse"),
        onLoaded: (el) => {
            urlInput = el.querySelectorAll('input')[0] as HTMLInputElement;
            reasonInput = el.querySelectorAll('textarea')[0] as HTMLTextAreaElement;
            if (pubId)
                urlInput.value = (shareUrl + pubId);
        },
        agreeLbl: lf("Submit"),
        jsx: <div className="ui form">
            <div className="ui field">
                <label>{lf("What is the URL of the offensive project?")}</label>
                <input type="url" tabIndex={0} autoFocus placeholder="Enter project URL here..."></input>
            </div>
            <div className="ui field">
                <label>{lf("Why do you find it offensive?")}</label>
                <textarea></textarea>
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