import * as React from "react";

export interface BadgeProps {
    onClick?: (badge: pxt.auth.Badge) => void;
    badge: pxt.auth.Badge;
    disabled?: boolean;
    isNew?: boolean;
}

export const Badge = (props: BadgeProps) => {
    const { badge, disabled, isNew, onClick } = props;

    const onBadgeClick = onClick && (() => {
        onClick(badge);
    })

    return (
        <div className={`profile-badge ${disabled ? "disabled" : ""}`}
            role="button"
            tabIndex={0}
            onClick={onBadgeClick}>
            {isNew && <div className="profile-badge-notification">{pxt.U.lf("New!")}</div>}
            <img src={badge.image} alt={badge.title} />
        </div>
    );
}