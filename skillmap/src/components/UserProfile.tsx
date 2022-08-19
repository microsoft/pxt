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


    handleOnClose = () => {
        this.props.dispatchCloseUserProfile();
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
