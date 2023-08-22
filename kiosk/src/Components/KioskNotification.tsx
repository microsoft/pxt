import { useEffect, useState } from "react";
import { tickEvent } from "../browserUtils";
import "../Kiosk.css";

interface IProps {
    setActive: (p: boolean) => void;
    duration?: number;
    content: string;
}

const KioskNotification: React.FC<IProps> = ({ setActive, duration=5000, content }) => {
    useEffect(() => {
        let notificationLength = setTimeout(() => {
            setActive(false);
        }, duration);

        return () => {
            clearTimeout(notificationLength);
        }
    }, [])

    return (
        <div className="notification-container">
            <div className="notification-contents">
                <p>{content}</p>
            </div>
        </div>
    )
}

export default KioskNotification;