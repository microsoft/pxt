import * as React from "react";
import { MenuDropdown, MenuItem } from "../controls/MenuDropdown";
import { classList } from "../util";

interface IProps {
    userProfile: pxt.auth.UserProfile;
    title: string;

    onSignOutClick?: () => void;
    className?: string;
    items?: MenuItem[];
}

export const UserAvatarDropdown: React.FC<IProps> = (props) => {
    const { userProfile, title, items, onSignOutClick, className } = props;

    const avatarUrl = userProfile?.idp?.pictureUrl ?? encodedAvatarPic(userProfile);

    const avatarElem = <UserAvatar avatarPicUrl={avatarUrl} />;
    const initialsElem = <UserInitials userProfile={userProfile} />;

    const allItems = items ? items.slice() : [];

    if (onSignOutClick) {
        allItems.unshift({
            id: "signout",
            title: lf("Sign Out"),
            label: lf("Sign Out"),
            onClick: onSignOutClick
        });
    }

    return (
        <MenuDropdown
            className={classList("user-avatar-dropdown", className)}
            title={title}
            label={avatarUrl ? avatarElem : initialsElem}
            items={allItems}
        />
    );
};

const UserInitials = (props: { userProfile: pxt.auth.UserProfile }) => (
    <span>
        <div className="user-avatar-initials" aria-hidden="true">{pxt.auth.userInitials(props.userProfile)}</div>
    </span>
);

const UserAvatar = (props: { avatarPicUrl: string }) => (
    <div className="user-avatar-image">
        <img src={props.avatarPicUrl} alt={lf("Profile Image")} referrerPolicy="no-referrer" aria-hidden="true" />
    </div>
);

function encodedAvatarPic(user: pxt.auth.UserProfile): string {
    const type = user?.idp?.picture?.mimeType;
    const encodedImg = user?.idp?.picture?.encoded;
    return type && encodedImg ? `data:${type};base64,${encodedImg}` : "";
}