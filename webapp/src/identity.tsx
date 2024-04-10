/// <reference path="../../localtypings/react.d.ts" />

import * as React from "react";
import * as sui from "./sui";
import * as auth from "./auth";
import * as data from "./data";
import * as cloud from "./cloud";
import { SignInModal } from "../../react-common/components/profile/SignInModal";

import ISettingsProps = pxt.editor.ISettingsProps;
import UserInfo = pxt.editor.UserInfo;


export type LoginDialogProps = ISettingsProps & {
};

export type LoginDialogState = {
    visible?: boolean;
    continuationHash?: string;
};

export class LoginDialog extends auth.Component<LoginDialogProps, LoginDialogState> {

    constructor(props: any) {
        super(props);

        this.state = {
            visible: false,
            continuationHash: ""
        };
    }

    public async show(continuationHash?: string) {
        this.setState({ visible: true, continuationHash });
    }

    public hide = () => {
        this.setState({ visible: false });
    }

    private signInAsync = async (provider: pxt.AppCloudProvider, rememberMe: boolean): Promise<void> => {
        pxt.tickEvent(`identity.loginClick`, { provider: provider.name, rememberMe: rememberMe.toString() });
        await auth.loginAsync(provider.id, rememberMe, {
            hash: this.state.continuationHash,
            params: pxt.Util.parseQueryString(window.location.search)
        });
    }

    renderCore() {
        const { visible } = this.state;

        return <>
            {visible && <SignInModal onClose={this.hide} onSignIn={this.signInAsync} />}
        </>;
    }
}

export type UserMenuProps = ISettingsProps & {
    continuationHash?: string;
};

type UserMenuState = {
};

export class UserMenu extends auth.Component<UserMenuProps, UserMenuState> {
    dropdown: sui.DropdownMenu;

    constructor(props: UserMenuProps) {
        super(props);
        this.state = {
        };
    }

    handleDropdownClicked = () => {
        const loggedIn = this.isLoggedIn();
        const githubUser = this.getData("github:user") as UserInfo;
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
        this.hide();
        this.props.parent.signOutGithub();
    }

    encodedAvatarPic(user: pxt.auth.UserProfile): string {
        const type = user?.idp?.picture.mimeType;
        const encodedImg = user?.idp?.picture.encoded;
        return `data:${type};base64,${encodedImg}`;
    }

    avatarPicUrl(): string {
        const user = this.getUserProfile();
        return user?.idp?.pictureUrl ?? this.encodedAvatarPic(user);
    }

    hide() {
        if (this.dropdown) {
            this.dropdown.hide();
        }
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
        );
        // Google user picture URL must have referrer policy set to no-referrer
        // eslint-disable-next-line: react/no-danger
        const avatarElem = (
            <div className="avatar">
                <img src={this.avatarPicUrl()} alt={lf("User Menu")} referrerPolicy="no-referrer" />
            </div>
        );
        const initialsElem = (
            <div className="avatar">
                <span className="initials">{pxt.auth.userInitials(user)}</span>
            </div>
        );
        const signedInElem = this.avatarPicUrl() ? avatarElem : initialsElem;

        const githubUser = this.getData("github:user") as UserInfo;

        return (
            <sui.DropdownMenu role="menuitem"
                title={title}
                className={`item icon user-dropdown-menuitem ${loggedIn ? 'logged-in-dropdown' : 'sign-in-dropdown'}`}
                titleContent={loggedIn ? signedInElem : signedOutElem}
                tabIndex={loggedIn ? 0 : -1}
                onClick={this.handleDropdownClicked}
                ref={ref => this.dropdown = ref}
            >
                {loggedIn ? <sui.Item role="menuitem" text={lf("My Profile")} onClick={this.handleProfileClicked} /> : undefined}
                {loggedIn ? <div className="ui divider"></div> : undefined}
                {githubUser ?
                    <sui.Item role="menuitem" title={lf("Unlink {0} from GitHub", githubUser.name)} onClick={this.handleUnlinkGitHubClicked}>
                        <div className="icon avatar" role="presentation">
                            <img className="circular image" src={githubUser.photo} alt={lf("User picture")} />
                        </div>
                        <span>{lf("Disconnect GitHub")}</span>
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