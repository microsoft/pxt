import * as React from "react";
import { BadgeList } from "./BadgeList";
import { UserPane } from "./UserPane";

import * as core from "../../core";
import { BadgeInfo } from "./BadgeInfo";

export interface ProfileProps {
    user: pxt.auth.State;
}

export const Profile = (props: ProfileProps) => {
    const { user } = props;

    const userProfile = user.profile || { idp: {} };

    const userBadges = user.preferences.badges || {badges: []};

    const onBadgeClick = (badge: pxt.auth.Badge) => {
        showBadgeInfoModal(badge);
    }

    return <div className="user-profile">
        <UserPane profile={userProfile} />
        <BadgeList
            availableBadges={testBadges}
            userState={userBadges}
            onBadgeClick={onBadgeClick}
        />
    </div>
}



function showBadgeInfoModal(badge: pxt.auth.Badge) {
    core.dialogAsync({
        header: lf("{0} Badge", badge.title),
        size: "tiny",
        hasCloseIcon: true,
        jsx: <BadgeInfo badge={badge} />
    });
}

const base: pxt.auth.Badge = {
    id: "beginner-skillmap",
    type: "skillmap",
    // image: "https://pxt.azureedge.net/blob/92bdf81ef84b8ef4d3b50e08a65808cdb73722eb/static/skillmap/backgrounds/beginner.png",
    image: "/static/beginner-badge.png",
    title: "Beginner Skillmap",
    timestamp: 0,
    sourceURL: "https://www.makecode.com/api/md/arcade/skillmap/beginner-skillmap"
}

const testBadges: pxt.auth.Badge[] = []
for (let i = 0; i < 13; i++) {
    testBadges.push({
        ...base,
        id: base.id + i
    })
}

