import * as React from "react";
import { UserNotification } from "./UserNotification";

export interface UserPaneProps {
    profile: pxt.auth.UserProfile;
}

export const UserPane = (props: UserPaneProps) => {
    const { profile } = props;

    const { username, displayName, picture } = profile.idp;

    return <div className="profile-user-pane">
        <div className="profile-portrait">
            <img src={picture?.dataUrl} alt={pxt.U.lf("Profile Picture")} />
        </div>
        <div className="profile-user-details">
            <div className="profile-display-name">
                {displayName}
            </div>
            { username &&
                <div className="profile-username">
                    {username}
                </div>
            }
        </div>
        <UserNotification
            title={lf("Today's Survey")}
            message={lf("What do you think about the cloud sign in feature?")}
            link=""
            actionText={lf("Take the survey")}
            icon="comments outline"/>
        <div className="profile-spacer"></div>
        <div className="profile-actions">
            <a>{lf("Delete Profile")}</a>
            <button className="ui icon button">
                <i className="icon sign-out"></i>
                {lf("Sign Out")}
            </button>
        </div>
    </div>
}