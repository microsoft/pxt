/// <reference path="../types.d.ts" />

import * as React from "react";
import { BadgeList } from "./BadgeList";
import { UserPane } from "./UserPane";
import { BadgeInfo } from "./BadgeInfo";
import { CheckboxStatus } from "../util";

export interface ProfileProps {
    user: pxt.auth.UserState;
    signOut: () => void;
    deleteProfile: () => void;
    checkedEmail: CheckboxStatus;
    onClickedEmail: (isChecked: boolean) => void;
    notification?: pxt.ProfileNotification;
    showModalAsync(options: DialogOptions): Promise<void>;
}

export const Profile = (props: ProfileProps) => {
    const { user, signOut, deleteProfile, onClickedEmail, notification, checkedEmail, showModalAsync } = props;
    const userProfile = user?.profile || { idp: {} };
    const userBadges = user?.preferences?.badges || { badges: [] };
    const showBadges = pxt.appTarget?.cloud?.showBadges || false;
    const profileSmall = pxt.appTarget.appTheme?.condenseProfile;
    const profileIcon = pxt.appTarget.appTheme?.cloudProfileIcon;

    const onBadgeClick = (badge: pxt.auth.Badge) => {
        showModalAsync({
            header: lf("{0} Badge", badge.title),
            size: "tiny",
            hasCloseIcon: true,
            onClose: () => {
                // Hack to support retrapping focus in the fullscreen modal that contains this element
                const focusable = document.body.querySelector(".common-modal-container.fullscreen [tabindex]");
                if (focusable) (focusable as HTMLElement).focus();
            },
            jsx: <BadgeInfo badge={badge} />
        });
    }

    return <div className="user-profile">
        <UserPane profile={userProfile} onSignOutClick={signOut} onDeleteProfileClick={deleteProfile} notification={notification}
                  emailChecked={checkedEmail} onEmailCheckClick={onClickedEmail}/>
        {showBadges && <BadgeList
            availableBadges={pxt.appTarget.defaultBadges || []}
            userState={userBadges}
            onBadgeClick={onBadgeClick}
        />}

        {profileSmall &&
            <div className="profile-info-container">
                <p className="profile-info">
                    {lf("Now that you're logged in, your projects will be automatically saved to the cloud so you can access them from any device! ")}
                    {lf("Learn more at ")}
                    <a href="https://arcade.makecode.com/identity/cloud-sync" target="_blank" rel="noopener noreferrer" tabIndex={0}>{lf("Cloud Sync ")}</a>
                    {lf("or ")}
                    <a href="https://makecode.com/privacy-faq" target="_blank" rel="noopener noreferrer" tabIndex={0}>{lf("Privacy ")}</a>
                    {lf("or ")}
                    <a href="https://arcade.makecode.com/identity/sign-in" target="_blank" rel="noopener noreferrer" tabIndex={0}>{lf("Identity.")}</a>
                </p>
                {profileIcon && <img
                    className="ui image centered medium"
                    src={profileIcon}
                    alt={lf("Image of microbit microcontroller surrounded by clouds")}
                />}
            </div>
        }
    </div>
}