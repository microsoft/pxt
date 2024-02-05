import { useContext } from "react";
import { AppStateContext } from "../state/appStateContext";

interface IProps {}

export const Notifications: React.FC<IProps> = ({}) => {
    const { state: teacherTool, dispatch } = useContext(AppStateContext);

    return (
        <div className="notification-container">
            {teacherTool.notifications.map((n, i) => (
                <div key={i} className="notification-contents">
                    <p>{n.message}</p>
                </div>
            ))}
        </div>
    );
};
