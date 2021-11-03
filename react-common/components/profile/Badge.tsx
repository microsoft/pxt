import * as React from "react";
import { fireClickOnEnter } from "../util";

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
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
            title={lf("{0} Badge", badge.title)}
            onClick={onBadgeClick}
            onKeyDown={fireClickOnEnter}>
            {isNew && <div className="profile-badge-notification">{pxt.U.lf("New!")}</div>}
            <img src={badge.image} alt={badge.title} />
            {disabled && <i className="ui huge icon lock" />}
        </div>
    );
}

