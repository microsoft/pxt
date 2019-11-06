import * as React from "react";
import * as sui from "./sui";
import * as pkg from "./package";
import * as cloudsync from "./cloudsync";

type ISettingsProps = pxt.editor.ISettingsProps;

interface GithubButtonState {
    pushPulling?: boolean;
}

export class GithubButton extends sui.UIElement<ISettingsProps, GithubButtonState> {
    constructor(props: ISettingsProps) {
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
        const { projectName, header } = this.props.parent.state;
        cloudsync.githubProvider().createRepositoryAsync(projectName, header)
            .done(r => r && this.props.parent.reloadHeaderAsync());
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
        // new github repo
        if (!ghid)
            return <sui.Button key="githubcreatebtn" className={`ui icon button editortools-btn editortools-github-btn`}
                icon="github" title={lf("create GitHub repository")} ariaLabel={lf("create GitHub repository")}
                onClick={this.createRepository} />

        // existing repo
        //const targetTheme = pxt.appTarget.appTheme;
        const mainPkg = pkg.mainEditorPkg()
        const meta: pkg.PackageMeta = this.getData("open-pkg-meta:" + mainPkg.getPkgId());
        const modified = meta && !!meta.numFilesGitModified;
        const repoName = ghid.project && ghid.tag ? `${ghid.project}${ghid.tag == "master" ? "" : `#${ghid.tag}`}` : ghid.fullName;
        const title = lf("Review and commit changes for {0}", repoName);

        return <div key="githubeditorbtn" role="button" className={`ui icon button editortools-btn editortools-github-btn`}
            title={title} onClick={this.handleClick}>
            <i className="github icon" />
            {modified ? <i className="up arrow icon" /> : undefined}
        </div>;
    }
}

