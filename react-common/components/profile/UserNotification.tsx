import * as React from "react";

export interface UserNotificationProps {
    notification: pxt.ProfileNotification;
}

export const UserNotification = (props: UserNotificationProps) => {
    const { message, icon, actionText, link, xicon, title } = props.notification;

    const onActionClick = () => {
        window.open(link, "_blank");
    }


    return (
        <div className="profile-notification">
            <div className="profile-notification-icon">
                <i className={`${xicon ? "xicon" : "ui large circular icon "} ${icon}`} />
            </div>
            <div className="profile-notification-title">
                {title}
            </div>
            <div className="profile-notification-message">
                {message}
            </div>
            <button className="ui icon button profile-notification-button" onClick={onActionClick} role="link" >
                <i className="icon external alternate"></i>
                {actionText}
            </button>
        </div>
    );
}