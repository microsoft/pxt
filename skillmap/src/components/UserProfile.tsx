import * as React from "react";
import { connect } from "react-redux";
import { SkillMapState } from "../store/reducer";
import * as authClient from "../lib/authClient";
import { Profile} from "react-common/profile/Profile";

import { Modal } from './Modal';

import { dispatchCloseUserProfile, dispatchShowDeleteAccountModal } from "../actions/dispatch"

interface UserProfileProps {
    signedIn: boolean;
    profile: pxt.auth.UserProfile
    preferences: pxt.auth.UserPreferences;
    showProfile: boolean;
    dispatchCloseUserProfile: () => void;
    dispatchShowDeleteAccountModal: () => void;
}


export class UserProfileImpl extends React.Component<UserProfileProps, {}> {
    render() {
        const { showProfile } = this.props;

        if (showProfile) {
            return this.renderUserProfile();
        }

        return <div/>
    }

    renderUserProfile = () => {
        const { profile, preferences } = this.props;

        return <Modal title={profile?.idp?.displayName || ""} fullscreen={true} onClose={this.handleOnClose}>
                <Profile
                    user={{profile, preferences}}
                    signOut={this.handleSignout}
                    deleteProfile={this.handleDeleteAccountClick}
                    // notification={this.state.notification}
                    showModalAsync={() => Promise.resolve()} />
        </Modal>
    }

    getAccountPanel = () => {
        const { profile } = this.props;
        const provider = profile?.idp?.provider && pxt.auth.identityProvider(profile?.idp?.provider);

        const avatarElem = (
            <div className="profile-pic avatar">
                <img src={profile?.idp?.picture?.dataUrl} alt={lf("User")} />
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
            {profile?.idp?.picture?.dataUrl ? avatarElem : initialsElem}
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
                <a className="ui"  title={lf("Provide feedback in a from")} href="https://aka.ms/AAcnpaj" target="_blank">
                    <i className="icon external alternate"></i>
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