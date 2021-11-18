import * as React from "react";
import { fireClickOnEnter } from "../util";
import { UserNotification } from "./UserNotification";
import { Checkbox, CheckboxStatus } from "../Checkbox";

export interface UserPaneProps {
    profile: pxt.auth.UserProfile;
    notification?: pxt.ProfileNotification;
    emailChecked: CheckboxStatus;

    onSignOutClick: () => void;
    onDeleteProfileClick: () => void;
    onEmailCheckClick: (isChecked: boolean) => void;
}

export const UserPane = (props: UserPaneProps) => {
    const { profile, onSignOutClick, onDeleteProfileClick, onEmailCheckClick, notification, emailChecked } = props;

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
        <div className="profile-email">
            <Checkbox isChecked={emailChecked} onClick={onEmailCheckClick}/>
            <div>
                {lf("I would like to receive the MakeCode newsletter. ")}
                <a href="https://makecode.com/privacy" target="_blank">{lf("View Privacy Statement")}</a>
            </div>
        </div>
        <div className="profile-actions">
            <a role="button"
                tabIndex={0}
                onKeyPress={fireClickOnEnter}
                onClick={onDeleteProfileClick}>
                {lf("Delete Profile")}
            </a>
            <button onClick={onSignOutClick} className="ui icon button sign-out">
                <i className="icon sign-out"></i>
                {lf("Sign Out")}
            </button>
        </div>
    </div>
}