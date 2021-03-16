import * as React from "react";
import * as sui from "./sui";
import * as pkg from "./package";
import * as cloudsync from "./cloudsync";
import * as workspace from "./workspace";

interface GithubButtonProps extends pxt.editor.ISettingsProps {
    className?: string;
}

interface GithubButtonState {
    pushPulling?: boolean;
}

export class GithubButton extends sui.UIElement<GithubButtonProps, GithubButtonState> {
    constructor(props: GithubButtonProps) {
        super(props);
        this.state = {};
        this.handleClick = this.handleClick.bind(this);
        this.handleButtonKeydown = this.handleButtonKeydown.bind(this);
        this.createRepository = this.createRepository.bind(this);
    }

    private handleButtonKeydown(e: React.KeyboardEvent<HTMLElement>) {
        e.stopPropagation();
    }

    private createRepository(e: React.MouseEvent<HTMLElement>) {
        pxt.tickEvent("github.button.create", undefined, { interactiveConsent: true });
        this.props.parent.createGitHubRepositoryAsync().done();
    }

    private handleClick(e: React.MouseEvent<HTMLElement>) {
        e.stopPropagation();
        const { header } = this.props.parent.state;
        if (!header) return;

        const { githubId } = header;
        if (!githubId) return;

        pxt.tickEvent("github.button.nav")
        const gitf = pkg.mainEditorPkg().lookupFile("this/" + pxt.github.GIT_JSON);
        if (gitf)
            this.props.parent.setSideFile(gitf);
    }

    renderCore() {
        const header = this.props.parent.state.header;
        if (!header) return <div />;

        const { githubId } = header;
        const ghid = pxt.github.parseRepoId(githubId);
        const defaultCls = "ui icon button editortools-btn editortools-github-btn"
        // new github repo
        if (!ghid)
            return <sui.Button key="githubcreatebtn" className={`${defaultCls} ${this.props.className || ""}`}
                icon="github" title={lf("create GitHub repository")} ariaLabel={lf("create GitHub repository")}
                onClick={this.createRepository} />

        // existing repo
        const meta: pkg.PackageGitStatus = this.getData("pkg-git-status:" + header.id);
        const pullStatus = meta && this.getData("pkg-git-pull-status:" + header.id);
        const hasissue = pullStatus == workspace.PullStatus.BranchNotFound;
        const haspull = pullStatus == workspace.PullStatus.GotChanges;
        const modified = meta && !!meta.modified;
        const repoName = ghid.project && ghid.tag ? `${ghid.project}${ghid.tag == "master" ? "" : `#${ghid.tag}`}` : ghid.fullName;
        // shrink name...
        const maxLength = 20;
        let displayName = ghid.tag && ghid.tag != "master" ? `#${ghid.tag}` : "";
        if (displayName.length > maxLength)
            displayName = displayName.slice(0, maxLength - 2) + '..';

        const title =
            hasissue ? lf("{0}: there is an issue with your GitHub connection.", repoName)
                : haspull ? lf("{0}: remote changes are ready to be pulled.", repoName)
                    : modified ? lf("{0}: review, commit & push local changes to GitHub.", repoName)
                        : lf("{0}: local changes are synchronized with GitHub.", repoName)

        return <div key="githubeditorbtn" role="button" className={`${defaultCls}
            ${this.props.className || ""}`}
            title={title} onClick={this.handleClick}>
            <i className="github icon" />
            <span className="ui mobile hide">{displayName}</span>
            <i className={`ui long ${
                hasissue ? "exclamation circle"
                    : haspull ? "arrow alternate down"
                        : modified ? "arrow alternate up"
                            : "check"} icon mobile hide`} />
        </div>;
    }
}
