import * as React from "react";
import * as sui from "./sui";
import * as core from "./core";
import * as auth from "./auth";
import * as data from "./data";
import * as cloudsync from "./cloudsync";
import * as cloud from "./cloud";
import { fireClickOnEnter } from "./util";

type ISettingsProps = pxt.editor.ISettingsProps;

export type LoginDialogProps = ISettingsProps & {
};

export type LoginDialogState = {
    visible?: boolean;
    rememberMe?: boolean;
    continuationHash?: string;
};

export class LoginDialog extends auth.Component<LoginDialogProps, LoginDialogState> {

    constructor(props: any) {
        super(props);

        this.state = {
            visible: false,
            rememberMe: false,
            continuationHash: ""
        };
    }

    private handleRememberMeChanged = (v: boolean) => {
        this.setState({ rememberMe: v });
    }

    public async show(continuationHash?: string) {
        this.setState({ visible: true, continuationHash });
    }

    public hide = () => {
        this.setState({ visible: false });
    }

    private async signInAsync(provider: pxt.AppCloudProvider): Promise<void> {
        pxt.tickEvent(`identity.loginClick`, { provider: provider.name, rememberMe: this.state.rememberMe.toString() });
        await auth.loginAsync(provider.id, this.state.rememberMe, {
            hash: this.state.continuationHash
        });
    }

    renderCore() {
        const { visible } = this.state;
        const msft = pxt.auth.identityProvider("microsoft");

        const buttons: sui.ModalButton[] = [];
        buttons.push({
            label: lf("Sign in"),
            onclick: async () => await this.signInAsync(msft),
            icon: "checkmark",
            approveButton: true,
            className: "positive"
        });

        const actions: JSX.Element[] = [];
        actions.push(<sui.PlainCheckbox label={lf("Remember me")} onChange={this.handleRememberMeChanged} />);

        return (
            <sui.Modal isOpen={visible} className="signindialog" size="tiny"
                onClose={this.hide} dimmer={true} buttons={buttons} actions={actions}
                closeIcon={true} header={lf("Sign into {0}", pxt.appTarget.appTheme.organizationText)}
                closeOnDimmerClick closeOnDocumentClick closeOnEscape>
                <p>{lf("Sign in with your Microsoft Account. We'll save your projects to the cloud, where they're accessible from anywhere.")}</p>
                <p>{lf("Don't have a Microsoft Account? Start signing in to create one!")}</p>
                <sui.Link className="ui" text={lf("Learn more")} icon="external alternate" ariaLabel={lf("Learn more")} href="/identity/sign-in" target="_blank" onKeyDown={fireClickOnEnter} />
            </sui.Modal>
        );
    }
}

export type UserMenuProps = ISettingsProps & {
    continuationHash?: string;
};

type UserMenuState = {
};

export class UserMenu extends auth.Component<UserMenuProps, UserMenuState> {
    constructor(props: UserMenuProps) {
        super(props);
        this.state = {
        };
    }

    handleDropdownClicked = () => {
        const loggedIn = this.isLoggedIn();
        const githubUser = this.getData("github:user") as pxt.editor.UserInfo;
        if (loggedIn || githubUser) {
            return true;
        } else {
            this.props.parent.showLoginDialog(this.props.continuationHash);
            return false;
        }
    }

    handleLoginClicked = () => {
        this.props.parent.showLoginDialog(this.props.continuationHash);
    }

    handleLogoutClicked = async () => {
        await auth.logoutAsync();
    }

    handleProfileClicked = () => {
        this.props.parent.showProfileDialog();
    }

    handleUnlinkGitHubClicked = () => {
        pxt.tickEvent("menu.github.signout");
        const githubProvider = cloudsync.githubProvider();
        if (githubProvider) {
            githubProvider.logout();
            this.props.parent.forceUpdate();
            core.infoNotification(lf("Signed out from GitHub..."))
        }
    }

    avatarPicUrl(): string {
        const user = this.getUserProfile();
        return user?.idp?.pictureUrl ?? user?.idp?.picture?.dataUrl;
    }

    renderCore() {
        const loggedIn = this.isLoggedIn();
        const user = this.getUserProfile();
        const icon = "xicon cloud-user large";
        const title = lf("User Menu");

        const signedOutElem = (
            <div className="signin-button">
                <div className="ui text widedesktop only">{lf("Sign In")}</div>
                {sui.genericContent({
                    icon
                })}
            </div>
        )
        const avatarElem = (
            <div className="avatar">
                <img src={this.avatarPicUrl()} alt={lf("User Menu")} />
            </div>
        );
        const initialsElem = (
            <div className="avatar">
                <span className="initials">{pxt.auth.userInitials(user)}</span>
            </div>
        );
        const signedInElem = this.avatarPicUrl() ? avatarElem : initialsElem;

        const githubUser = this.getData("github:user") as pxt.editor.UserInfo;

        return (
            <sui.DropdownMenu role="menuitem"
                title={title}
                className={`item icon user-dropdown-menuitem ${loggedIn ? 'logged-in-dropdown' : 'sign-in-dropdown'}`}
                titleContent={loggedIn ? signedInElem : signedOutElem}
                tabIndex={loggedIn ? 0 : -1}
                onClick={this.handleDropdownClicked}
            >
                {loggedIn ? <sui.Item role="menuitem" text={lf("My Profile")} onClick={this.handleProfileClicked} /> : undefined}
                {loggedIn ? <div className="ui divider"></div> : undefined}
                {githubUser ?
                    <sui.Item role="menuitem" title={lf("Unlink {0} from GitHub", githubUser.name)} onClick={this.handleUnlinkGitHubClicked}>
                        <div className="icon avatar" role="presentation">
                            <img className="circular image" src={githubUser.photo} alt={lf("User picture")} />
                        </div>
                        <span>{lf("Unlink GitHub")}</span>
                    </sui.Item>
                    : undefined}
                {githubUser && <div className="ui divider"></div>}
                {!loggedIn ? <sui.Item role="menuitem" text={lf("Sign in")} onClick={this.handleLoginClicked} /> : undefined}
                {loggedIn ? <sui.Item role="menuitem" text={lf("Sign out")} onClick={this.handleLogoutClicked} /> : undefined}
            </sui.DropdownMenu>
        );
    }
}

export type CloudSaveStatusProps = {
    headerId: string;
};

export class CloudSaveStatus extends data.Component<CloudSaveStatusProps, {}> {
    public static wouldRender(headerId: string): boolean {
        const cloudMd = cloud.getCloudTempMetadata(headerId);
        const cloudStatus = cloudMd.cloudStatus();
        return !!cloudStatus && cloudStatus.value !== "none" && auth.hasIdentity();
    }

    renderCore() {
        if (!this.props.headerId) { return null; }
        const cloudMd = this.getData<cloud.CloudTempMetadata>(`${cloud.HEADER_CLOUDSTATE}:${this.props.headerId}`);
        const cloudStatus = cloudMd.cloudStatus();
        const showCloudButton = !!cloudStatus && cloudStatus.value !== "none" && auth.hasIdentity();
        if (!showCloudButton) { return null; }
        const preparing = cloudStatus.value === "localEdits";
        const syncing = preparing || cloudStatus.value === "syncing";

        return (<div className="cloudstatusarea">
            {!syncing && <sui.Item className={"ui tiny cloudicon xicon " + cloudStatus.icon} title={cloudStatus.tooltip} tabIndex={-1}></sui.Item>}
            {syncing && <sui.Item className={"ui tiny inline loader active cloudprogress" + (preparing ? " indeterminate" : "")} title={cloudStatus.tooltip} tabIndex={-1}></sui.Item>}
            {cloudStatus.value !== "none" && cloudStatus.value !== "synced" && <span className="ui mobile hide no-select cloudtext" role="note">{cloudStatus.shortStatus}</span>}
        </div>);
    }
}