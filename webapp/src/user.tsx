import * as React from "react";
import * as sui from "./sui";
import * as core from "./core";
import * as auth from "./auth";
import * as cloudsync from "./cloudsync";

type ISettingsProps = pxt.editor.ISettingsProps;

export type ProfileTab = 'settings' | 'privacy' | 'my-stuff';


export type ProfileDialogProps = ISettingsProps & {
};

type ProfileDialogState = {
    visible?: boolean;
    location?: ProfileTab;
};

export class ProfileDialog extends auth.Component<ProfileDialogProps, ProfileDialogState> {
    constructor(props: ProfileDialogProps) {
        super(props);
        this.state = {
            visible: props.visible,
            location: 'my-stuff'
        };
    }

    show(location?: string) {
        location = location ?? 'my-stuff';
        this.setState({
            visible: true,
            location: location as ProfileTab
        });
    }

    hide = () => {
        this.setState({ visible: false });
    }

    handleTabClick = (id: ProfileTab) => {
        this.setState({ location: id });
    }

    renderCore() {
        const isLoggedIn = this.isLoggedIn();
        if (!isLoggedIn) return null;

        const user = this.getUser();

        return (
            <sui.Modal isOpen={this.state.visible} className="ui profiledialog" size="fullscreen"
                onClose={this.hide} dimmer={true}
                closeIcon={true} header={user?.idp?.displayName}
                closeOnDimmerClick={false}
                closeOnDocumentClick={false}
                closeOnEscape={false}
            >
                <AccountPanel parent={this} />
                <GitHubPanel parent={this} />
                <PrivacyPanel parent={this} />
            </sui.Modal>
        );
    }
}

type PanelProps = {
    parent: ProfileDialog;
};

type AccountPanelProps = PanelProps & {
};

class AccountPanel extends sui.UIElement<AccountPanelProps, {}> {

    handleSignoutClicked = () => {
        auth.logout();
    }

    renderCore() {
        const user = this.getData<auth.UserProfile>(auth.USER);

        const avatarElem = (
            <div className="profile-pic avatar">
                <img src={user?.idp?.picture?.dataUrl} alt={lf("User")} />
            </div>
        );
        const initialsElem = (
            <div className="profile-pic avatar">
                <span>{cloudsync.userInitials(user?.idp?.displayName)}</span>
            </div>
        );

        return (
            <div className="ui card account">
                <div className="header-text">
                    <label>{lf("Account")}</label>
                </div>
                {user?.idp?.picture?.dataUrl ? avatarElem : initialsElem}
                <div className="username">
                    <label className="title">{lf("Account")}</label>
                    <p className="value">{user?.idp?.username}</p>
                </div>
                <div className="signout">
                    <sui.Button text={lf("Sign out")} icon={`xicon ${user?.idp?.provider}`} ariaLabel={lf("Sign out {0}", user?.idp?.provider)} onClick={this.handleSignoutClicked} />
                </div>
            </div>
        );
    }
}

type GitHubPanelProps = PanelProps & {
};

class GitHubPanel extends sui.UIElement<GitHubPanelProps, {}> {

    handleUnlinkClicked = () => {
        const github = cloudsync.githubProvider();
        if (github) {
            github.logout();
        }
    }

    renderUsername(): JSX.Element {
        const github = cloudsync.githubProvider();
        const user = github.user();
        return (
            <div className="connected">
                <label className="title">{lf("Username")}</label>
                <p className="value">{user?.userName}</p>
            </div>
        )
    }

    renderUnlink(): JSX.Element {
        return (
            <div className="unlink">
                <sui.Button text={lf("Unlink")} icon="github" ariaLabel={lf("Unlink GitHub")} onClick={this.handleUnlinkClicked} />
            </div>
        );
    }

    renderDisconnected(): JSX.Element {
        return (
            <div className="disconnected">
                <p className="description">{lf("You haven't linked a GitHub account.")}</p>
            </div>
        )
    }

    renderCore() {
        const github = cloudsync.githubProvider();
        if (!github) return null;
        const user = github.user();

        return (
            <div className="ui card github">
                <div className="header-text">
                    <label>{lf("GitHub")}</label>
                </div>
                {user?.photo ?
                    <div className="profile-pic avatar">
                        <img src={user.photo} alt={lf("GitHub user photo")} />
                    </div> : undefined}
                {user ? this.renderUsername() : undefined}
                {user ? this.renderUnlink() : undefined}
                {!user ? this.renderDisconnected() : undefined}
            </div>
        );
    }
}

type PrivacyPanelProps = PanelProps & {
};

class PrivacyPanel extends sui.UIElement<PrivacyPanelProps, {}> {

    handleDeleteAccountClick = async () => {
        const result = await core.confirmAsync({
            header: lf("Delete Account"),
            body: lf("You are about to delete your account. You can't undo this. Are you sure?"),
            agreeClass: "red",
            agreeIcon: "delete",
            agreeLbl: lf("Delete my account"),
        });
        if (result) {
            await auth.deleteAccount();
            // Exit out of the profile screen.
            this.props.parent.hide();
            core.infoNotification(lf("Account deleted!"));
        }
    }

    renderCore() {
        return (
            <div className="ui card privacy">
                <div className="header-text">
                    <label>{lf("Privacy")}</label>
                </div>
                <div className="export-data-desc">
                    <p className="description">{lf("You can view and export all the information we have about you at any time.")}</p>
                </div>
                <div className="export-data-btn">
                    <sui.Button text={lf("Request Data")} />
                </div>
                <div className="delete-acct-desc">
                    <p></p>
                    <p className="description">{lf("You can delete your account. Warning: This will delete all your saved projects! If you want to preserve them, export your data first.")}</p>
                </div>
                <div className="delete-acct-btn">
                    <sui.Button ariaLabel={lf("Delete Account")} className="red" text={lf("Delete Account")} onClick={this.handleDeleteAccountClick} />
                </div>
            </div>
        );
    }
}

