import { useEffect, useContext, useState } from "react";
import "./teacherTool.css";
import { AppStateContext, AppStateReady } from "./state/appStateContext";
import { usePromise } from "./hooks";
import HeaderBar from "./components/HeaderBar";
import Notifications from "./components/Notifications";
import * as NotificationService from "./services/notificationService";
import { postNotification } from "./transforms/postNotification";
import { makeNotification } from "./utils";

function App() {
    const { state, dispatch } = useContext(AppStateContext);
    const [didNotify, setDidNotify] = useState(false);

    const ready = usePromise(AppStateReady, false);

    useEffect(() => {
        // Init subsystems.
        NotificationService.initialize();
    }, [ready]);

    // Test notification
    useEffect(() => {
        if (ready && !didNotify) {
            postNotification(makeNotification("🎓", 2000));
            setDidNotify(true);
        }
    }, [ready]);

    return (
        <>
            <HeaderBar />
            <Notifications />
        </>
    );
}

export default App;
