import { useEffect, useContext, useState } from "react";
// eslint-disable-next-line import/no-unassigned-import
import "./teacherTool.css";
import { AppStateContext, AppStateReady } from "./state/appStateContext";
import { usePromise } from "./hooks";
import { makeNotification } from "./utils";
import * as Actions from "./state/actions";
import * as NotificationService from "./services/notificationService";
import { downloadTargetConfigAsync } from "./services/ackendRequests";
import { logDebug } from "./services/loggingService";

import HeaderBar from "./components/HeaderBar";
import Notifications from "./components/Notifications";
import DebugInput from "./components/DebugInput";
import { MakeCodeFrame } from "./components/MakecodeFrame";
import EvalResultDisplay from "./components/EvalResultDisplay";
import ActiveRubricDisplay from "./components/ActiveRubricDisplay";
import CatalogModal from "./components/CatalogModal";

import { postNotification } from "./transforms/postNotification";
import { loadCatalogAsync } from "./transforms/loadCatalogAsync";
import { loadValidatorPlans } from "./transforms/loadValidatorPlans";


function App() {
    const { state, dispatch } = useContext(AppStateContext);
    const [inited, setInited] = useState(false);

    const ready = usePromise(AppStateReady, false);

    useEffect(() => {
        if (ready && !inited) {
            NotificationService.initialize();
            Promise.resolve().then(async () => {
                const cfg = await downloadTargetConfigAsync();
                dispatch(Actions.setTargetConfig(cfg || {}));
                pxt.BrowserUtils.initTheme();

                // Load catalog and validator plans into state.
                await loadCatalogAsync();
                await loadValidatorPlans();

                // TODO: Remove this. Delay app init to expose any startup race conditions.
                setTimeout(() => {
                    // Test notification
                    postNotification(makeNotification("🎓", 2000));
                    setInited(true);

                    logDebug("App initialized");
                }, 10);
            });
        }
    }, [ready, inited]);

    return !inited ? (
        <div className="ui active dimmer">
            <div className="ui large main loader msft"></div>
        </div>
    ) : (
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
