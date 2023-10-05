import { useContext } from "react";
import { AppStateContext } from "../State/AppStateContext";

interface IProps {}

const Notifications: React.FC<IProps> = ({}) => {
    const { state: kiosk, dispatch } = useContext(AppStateContext);

    return (
        <div className="notification-container">
            {kiosk.notifications.map((n, i) => (
                <div key={i} className="notification-contents">
                    <p>{n.message}</p>
                </div>
            ))}
        </div>
    );
};

export default Notifications;
