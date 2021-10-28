import * as React from "react";
import { UserNotification } from "./UserNotification";

export interface UserPaneProps {
    profile: pxt.auth.UserProfile;
    notification?: pxt.ProfileNotification;

    onSignOutClick: () => void;
    onDeleteProfileClick: () => void;
}

export const UserPane = (props: UserPaneProps) => {
    const { profile, onSignOutClick, onDeleteProfileClick, notification } = props;

    const { username, displayName, picture } = profile.idp;

    return <div className="profile-user-pane">
        <div className="profile-portrait">
            { picture?.dataUrl ?
                <img src={picture?.dataUrl} alt={pxt.U.lf("Profile Picture")} />
                : <div className="profile-initials-portrait">
                    {pxt.auth.userInitials(profile)}
                </div>
            }
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
        { notification && <UserNotification notification={notification}/> }
        <div className="profile-spacer"></div>
        <div className="profile-actions">
            <a onClick={onDeleteProfileClick}>{lf("Delete Profile")}</a>
            <button onClick={onSignOutClick} className="ui icon button">
                <i className="icon sign-out"></i>
                {lf("Sign Out")}
            </button>
        </div>
    </div>
}