import * as React from "react";
import { connect } from "react-redux";
import { SkillMapState } from "../store/reducer";
import * as authClient from "../lib/authClient";
import { infoNotification, errorNotification } from "../lib/notifications"

import { Modal } from 'react-common/controls/Modal';
import { CheckboxStatus} from "react-common/util";
import { Profile} from "react-common/profile/Profile";

import { dispatchCloseUserProfile, dispatchShowDeleteAccountModal } from "../actions/dispatch"

interface UserProfileProps {
    signedIn: boolean;
    profile: pxt.auth.UserProfile
    showProfile: boolean;
    preferences?: pxt.auth.UserPreferences;
    dispatchCloseUserProfile: () => void;
    dispatchShowDeleteAccountModal: () => void;
}

interface UserProfileState {
    notification?: pxt.ProfileNotification;
    modal?: DialogOptions;
    emailSelected: CheckboxStatus;
}

export class UserProfileImpl extends React.Component<UserProfileProps, UserProfileState> {
    constructor(props: UserProfileProps) {
        super(props);

        authClient.userPreferencesAsync().
            then( pref => this.setState({ emailSelected: pref?.email ? CheckboxStatus.Selected : CheckboxStatus.Unselected })
        )
        pxt.targetConfigAsync()
            .then(config => this.setState({ notification: config.profileNotification }));
    }

    render() {
        const { showProfile } = this.props;

        if (showProfile) {
            return this.renderUserProfile();
        }

        return <div/>
    }

    renderUserProfile = () => {
        const { profile, preferences } = this.props;
        const { notification, modal, emailSelected } = this.state;

        return <Modal
            title={lf("My Profile")}
            fullscreen={true}
            onClose={this.handleOnClose}
            parentElement={document.querySelector(".app-container") || undefined}>
                <Profile
                    user={{profile, preferences}}
                    signOut={this.handleSignout}
                    deleteProfile={this.handleDeleteAccountClick}
                    notification={notification}
                    showModalAsync={this.showModalAsync}
                    checkedEmail={emailSelected}
                    onClickedEmail={this.handleEmailClick} />

                {modal &&
                    <Modal title={modal.header} onClose={this.closeModal} className={modal.className}>
                        {modal.jsx}
                    </Modal>
                }
        </Modal>
    }

    avatarPicUrl = (): string | undefined => {
        const { profile } = this.props;
        return profile?.idp?.pictureUrl ?? profile?.idp?.picture?.dataUrl;
    }

    getAccountPanel = () => {
        const { profile } = this.props;
        const provider = profile?.idp?.provider && pxt.auth.identityProvider(profile?.idp?.provider);

        const avatarElem = (
            <div className="profile-pic avatar">
                <img src={this.avatarPicUrl()} alt={lf("User")} />
            </div>
        );
        const initialsElem = (
            <div className="profile-pic avatar">
                <span>{pxt.auth.userInitials(profile)}</span>
            </div>
        );

        return <div className="account panel ui card">
            <div className="header-text">
                <label>{lf("Profile")}</label>
            </div>
            {this.avatarPicUrl() ? avatarElem : initialsElem}
            <div className="row-span-two">
                <label className="title">{lf("Name")}</label>
                <p className="value">{profile?.idp?.displayName || profile?.idp?.username}</p>
            </div>
            <div className="row-span-two">
                <label className="title">{lf("Username")}</label>
                <p className="value">{profile?.idp?.username}</p>
            </div>
            <div className="row-span-two">
                <label className="title">{lf("Provider")}</label>
                <p className="value">{provider?.name}</p>
            </div>
            <div className="row-span-two" onClick={this.handleSignout}>
                <div className="ui icon button" >
                    <span className={`xicon ${profile?.idp?.provider}`} />
                    <span> {lf("Sign out")} </span>
                </div>
            </div>
            <div className="row-span-two">
                <a className="ui" title={lf("delete profile")} onClick={this.handleDeleteAccountClick}>{lf("I want to delete my profile")} </a>
            </div>
        </div>
    }

    handleOnClose = () => {
        this.props.dispatchCloseUserProfile();
    }

    getFeedbackPanel = () => {
        return <div className="feedback panel ui card">
            <div className="header-text">
                <label>{lf("Feedback")}</label>
            </div>
            <div className="row-span-two">
                { lf("What do you think about the Sign In & Cloud Save feature? Is there something you'd like to change? Did you encounter issues? Please let us know!") }
            </div>
            <div className="row-span-two">
                <a className="ui"  title={lf("Provide feedback in a form")} href="https://aka.ms/AAcnpaj" target="_blank">
                    <i className="fas fa-external-link-alt"></i>
                    { lf("Take the Survey") }
                </a>
            </div>
        </div>
    }

    handleSignout = async () => {
        pxt.tickEvent(`skillmap.userprofile.signout`);
        authClient.logoutAsync(location.hash);
    }

    handleDeleteAccountClick = async () => {
        this.props.dispatchShowDeleteAccountModal();
    }

    handleEmailClick = (isSelected: boolean) => {
        this.setState({ emailSelected: CheckboxStatus.Waiting })
        authClient.setEmailPrefAsync(isSelected).then(setResult => {
            if (setResult?.success) {
                infoNotification(lf("Settings saved"))
                this.setState({ emailSelected: setResult.res?.email ? CheckboxStatus.Selected : CheckboxStatus.Unselected})
            } else {
                errorNotification(lf("Oops, something went wrong"))
                this.setState({ emailSelected: !isSelected ? CheckboxStatus.Selected: CheckboxStatus.Unselected })
            }
        })
    }

    showModalAsync = async (options: DialogOptions) => {
        this.setState({ modal: options });
    }

    closeModal = () => {
        const onClose = this.state.modal?.onClose;

        this.setState({ modal: undefined });
        if (onClose) onClose();
    }
}

function mapStateToProps(state: SkillMapState, ownProps: any) {
    if (!state) return {};

    return {
        signedIn: state.auth.signedIn,
        profile: state.auth.profile,
        showProfile: state.showProfile,
        preferences: state.auth.preferences
    }
}

const mapDispatchToProps = {
    dispatchCloseUserProfile,
    dispatchShowDeleteAccountModal
}

export const UserProfile = connect(mapStateToProps, mapDispatchToProps)(UserProfileImpl);
