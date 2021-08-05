import * as React from "react";
 import { connect } from "react-redux";
import { SkillMapState } from "../store/reducer";

interface UserProfileProps {
    signedIn: boolean;
    profile: pxt.auth.UserProfile
}


export class UserProfilImpl extends React.Component<UserProfileProps> {
    render() {
        return <div className="profiledialog">
            {this.getAccountPanel()}
            {this.getFeedbackPanel()}
        </div>
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
                <span>{pxt.auth.userInitials(profile?.idp?.displayName || "")}</span>
            </div>
        );

        return <div className="account-panel ui card">
            <div className="header-text">
                <label>{lf("Profile")}</label>
            </div>
            {profile?.idp?.picture?.dataUrl ? avatarElem : initialsElem}
            <div className="row-span-two">
                <label className="title">{lf("Name")}</label>
                <p className="value">{profile?.idp?.displayName}</p>
            </div>
            <div className="row-span-two">
                <label className="title">{lf("Username")}</label>
                <p className="value">{profile?.idp?.username}</p>
            </div>
            <div className="row-span-two">
                <label className="title">{lf("Provider")}</label>
                <p className="value">{provider?.name}</p>
            </div>
            <div className="row-span-two">
                {/* <sui.Button text={lf("Sign out")} icon={`xicon ${profile?.idp?.provider}`} ariaLabel={lf("Sign out {0}", profile?.idp?.provider)} onClick={this.handleSignoutClicked} /> */}
            </div>
            <div className="row-span-two">
                {/* <sui.Link className="ui" text={lf("I want to delete my profile")} ariaLabel={lf("delete profile")} onClick={this.handleDeleteAccountClick} /> */}
            </div>
        </div>
    }

    getFeedbackPanel = () => {
        return <div className="feedback-panel ui card">

        </div>
    }
}

function mapStateToProps(state: SkillMapState) {
    if (!state) return {};

    return {
        signedIn: state.auth.signedIn,
        profile: state.auth.profile
    }
}

export const UserProfile = connect(mapStateToProps)(UserProfilImpl);