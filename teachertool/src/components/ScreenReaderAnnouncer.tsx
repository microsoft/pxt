import { useContext } from "react";
import { AppStateContext } from "../state/appStateContext";

export interface ScreenReaderAnnouncerProps {}
export const ScreenReaderAnnouncer: React.FC<ScreenReaderAnnouncerProps> = () => {
    const { state: teacherTool } = useContext(AppStateContext);
    return (
        <>
            {teacherTool.screenReaderAnnouncement && (
                <div className="sr-only" aria-live="polite">
                    {teacherTool.screenReaderAnnouncement}
                </div>
            )}
        </>
    );
};
