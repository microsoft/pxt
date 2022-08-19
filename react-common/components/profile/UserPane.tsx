/// <reference path="../types.d.ts" />
/// <reference path="../../../localtypings/react.d.ts" />

import * as React from "react";
import { fireClickOnEnter, CheckboxStatus } from "../util";
import { UserNotification } from "./UserNotification";
import { Checkbox } from "../controls/Checkbox";
import { Button } from "../controls/Button";

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

    const { username, displayName, picture, pictureUrl } = profile.idp;

    const picUrl = pictureUrl ?? picture?.dataUrl;

    const emailLabel = <>
        {emailChecked === CheckboxStatus.Waiting ? <div className="common-spinner" /> : undefined}
        {lf("I would like to receive the MakeCode newsletter. ")}
        <a href="https://makecode.com/privacy" target="_blank" rel="noopener noreferrer" tabIndex={0}>{lf("View Privacy Statement")}</a>
    </>

    return <div className="profile-user-pane">
        <div className="profile-portrait">
            { picUrl ?
                // Google user picture URL must have referrer policy set to no-referrer
                <div>
                    <img src={picUrl} alt={pxt.U.lf("Profile Picture")} referrerPolicy="no-referrer" />
                </div>
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
            <Checkbox id="profile-email-checkbox"
                className={emailChecked === CheckboxStatus.Waiting ? "loading" : ""}
                isChecked={emailChecked === CheckboxStatus.Selected}
                onChange={onEmailCheckClick}
                label={emailLabel}/>
        </div>
        <div className="profile-actions">
            <Button
                className="link-button"
                title={lf("Delete Profile")}
                label={lf("Delete Profile")}
                onClick={onDeleteProfileClick}
            />
            <Button
                className="sign-out"
                leftIcon="fas fa-sign-out-alt"
                title={lf("Sign Out")}
                label={lf("Sign Out")}
                onClick={onSignOutClick}
                />
        </div>
    </div>
}