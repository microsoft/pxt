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

    handleDeleteAccountClick = async () => {
        const profile = this.getData<auth.UserProfile>(auth.USER)
        const result = await core.confirmAsync({
            header: lf("Delete Account"),
            body: lf("You are about to delete your account. YOU CAN NOT UNDO THIS! Are you sure?"),
            agreeClass: "red",
            agreeIcon: "delete",
            agreeLbl: lf("Delete my account"),
            confirmationText: profile?.idp?.displayName || profile?.idp?.username || lf("User")
        });
        if (result) {
            await auth.deleteAccount();
            // Exit out of the profile screen.
            this.props.parent.hide();
            core.infoNotification(lf("Account deleted!"));
        }
    }

    renderCore() {
        const user = this.getData<auth.UserProfile>(auth.USER);
        const provider = auth.identityProvider(user.idp.provider);

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
            <div className="ui card panel">
                <div className="header-text">
                    <label>{lf("Account")}</label>
                </div>
                {user?.idp?.picture?.dataUrl ? avatarElem : initialsElem}
                <div className="row">
                    <label className="title">{lf("Name")}</label>
                    <p className="value">{user?.idp?.displayName}</p>
                </div>
                <div className="row">
                    <label className="title">{lf("Username")}</label>
                    <p className="value">{user?.idp?.username}</p>
                </div>
                <div className="row">
                    <label className="title">{lf("Provider")}</label>
                    <p className="value">{provider.name}</p>
                </div>
                <div className="row">
                    <sui.Button text={lf("Sign out")} icon={`xicon ${user?.idp?.provider}`} ariaLabel={lf("Sign out {0}", user?.idp?.provider)} onClick={this.handleSignoutClicked} />
                </div>
                <div className="row">
                    <label className="title">{lf("Delete Account")}</label>
                    <p className="description">{lf("Warning: Deleting your account will delete your cloud-saved projects! No undo. If you want to preserve your projects, save them to disk first.")}</p>
                    <sui.Button ariaLabel={lf("Delete Account")} className="red" text={lf("Delete Account")} onClick={this.handleDeleteAccountClick} />
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
            <>
                <div className="row">
                    <label className="title">{lf("Name")}</label>
                    <p className="value">{user?.name}</p>
                </div>
                <div className="row">
                    <label className="title">{lf("Username")}</label>
                    <p className="value">{user?.userName}</p>
                </div>
            </>
        )
    }

    renderUserPhoto(url: string): JSX.Element {
        return (
            <div className="profile-pic avatar">
                <img src={url} alt={lf("GitHub user photo")} />
            </div>
        );
    }

    renderUnlink(): JSX.Element {
        return (
            <div className="row">
                <sui.Button text={lf("Unlink")} icon="github" ariaLabel={lf("Unlink GitHub")} onClick={this.handleUnlinkClicked} />
            </div>
        );
    }

    renderDisconnected(): JSX.Element {
        return (
            <div className="row">
                <p className="description">{lf("You haven't linked a GitHub account.")}</p>
            </div>
        )
    }

    renderCore() {
        const github = cloudsync.githubProvider();
        if (!github) return null;
        const user = github.user();

        return (
            <div className="ui card panel">
                <div className="header-text">
                    <label>{lf("GitHub")}</label>
                </div>
                {user?.photo ? this.renderUserPhoto(user.photo) : undefined}
                {user ? this.renderUsername() : undefined}
                {user ? this.renderUnlink() : undefined}
                {!user ? this.renderDisconnected() : undefined}
            </div>
        );
    }
}
