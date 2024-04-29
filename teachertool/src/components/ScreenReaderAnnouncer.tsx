import { useContext } from "react";
import { AppStateContext } from "../state/appStateContext";
import css from "./styling/ActionAnnouncer.module.scss";

export interface ScreenReaderAnnouncerProps {}
export const ScreenReaderAnnouncer: React.FC<ScreenReaderAnnouncerProps> = () => {
    const { state: teacherTool } = useContext(AppStateContext);
    return (
        <>
            {teacherTool.screenReaderAnnouncement && (
                <div className={css["sr-only"]} aria-live="polite">
                    {teacherTool.screenReaderAnnouncement}
                </div>
            )}
        </>
    );
};
