import { useEffect, useContext, useState } from "react";
// eslint-disable-next-line import/no-unassigned-import
import "./teacherTool.css";
import { AppStateContext, AppStateReady } from "./state/appStateContext";
import { usePromise } from "./hooks";
import { makeNotification } from "./utils";
import * as NotificationService from "./services/notificationService";

import HeaderBar from "./components/HeaderBar";
import Notifications from "./components/Notifications";
import DebugInput from "./components/DebugInput";
import { MakeCodeFrame } from "./components/MakecodeFrame";
import EvalResultDisplay from "./components/EvalResultDisplay";
import ActiveRubricDisplay from "./components/ActiveRubricDisplay";
import CatalogModal from "./components/CatalogModal";

import { postNotification } from "./transforms/postNotification";
import { loadCatalog } from "./transforms/loadCatalog";


function App() {
    const { state, dispatch } = useContext(AppStateContext);
    const [didNotify, setDidNotify] = useState(false);

    const ready = usePromise(AppStateReady, false);

    useEffect(() => {
        if (ready) {
            // Init subsystems.
            NotificationService.initialize();

            // Load criteria catalog
            loadCatalog();
        }
    }, [ready]);

    // Test notification
    useEffect(() => {
        if (ready && !didNotify) {
            postNotification(makeNotification("🎓", 2000));
            setDidNotify(true);
        }
    }, [ready]);

    return (
        <div className="app-container">
            <HeaderBar />
            <div className="inner-app-container">
                <DebugInput />
                <ActiveRubricDisplay />
                <EvalResultDisplay />
                <MakeCodeFrame />
            </div>
            <CatalogModal />
            <Notifications />
        </div>
    );
}

export default App;
