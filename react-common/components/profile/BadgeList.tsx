import * as React from "react";
import { Badge } from "./Badge";

export interface BadgeListProps {
    onBadgeClick: (badge: pxt.auth.Badge) => void;
    availableBadges: pxt.auth.Badge[];
    userState: pxt.auth.UserBadgeState;
}

export const BadgeList = (props: BadgeListProps) => {
    const { onBadgeClick, availableBadges, userState } = props;

    const badges = availableBadges.slice();

    let unlocked: pxt.Map<boolean> = {};

    for (const badge of userState.badges) {
        unlocked[badge.id] = true;
        const existing = badges.findIndex(b => b.id === badge.id);
        if (existing > -1) {
            badges[existing] = {
                ...badges[existing],
                timestamp: badges[existing].timestamp || badge.timestamp
            }
        } else {
            badges.push(badge);
        }
    }

    const bg: JSX.Element[] = []
    for (let i = 0; i < Math.max(badges.length + 10, 20); i++) {
        bg.push(<div key={i} className="placeholder-badge" />)
    }

    return <div className="profile-badge-list">
        <div className="profile-badge-header" id="profile-badge-header">
            <span className="profile-badge-title">
                {lf("Badges")}
            </span>

            <span className="profile-badge-subtitle">
                {lf("Click each badge to see details")}
            </span>
        </div>
        <div className="profile-badges-scroller">
            <div className="profile-badges" role="list" aria-labelledby="profile-badge-header">
                <div className="profile-badges-background-container" aria-hidden="true">
                    <div className="profile-badges-background">
                        { bg }
                    </div>
                </div>
                { badges.map(badge =>
                    <div className="profile-badge-and-title" key={badge.id} role="listitem">
                        <Badge
                            onClick={onBadgeClick}
                            badge={badge}
                            disabled={!unlocked[badge.id]}
                        />
                        <div className="profile-badge-name">
                            {badge.title}
                        </div>
                    </div>
                ) }
            </div>
        </div>
    </div>
}