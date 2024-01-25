import { useEffect, useContext, useState } from "react";
// eslint-disable-next-line import/no-unassigned-import
import "./teacherTool.css";
import { AppStateContext, AppStateReady } from "./state/appStateContext";
import { usePromise } from "./hooks";
import HeaderBar from "./components/HeaderBar";
import Notifications from "./components/Notifications";
import * as NotificationService from "./services/notificationService";
import { postNotification } from "./transforms/postNotification";
import { makeNotification } from "./utils";
import DebugInput from "./components/DebugInput";
import { MakeCodeFrame } from "./components/MakecodeFrame";
import EvalResultDisplay from "./components/EvalResultDisplay";
import { downloadTargetConfigAsync } from "./services/backendRequests";
import * as Actions from "./state/actions";
import { logDebug } from "./services/loggingService";

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
                <EvalResultDisplay />
                <MakeCodeFrame />
            </div>
            <Notifications />
        </div>
    );
}

export default App;
