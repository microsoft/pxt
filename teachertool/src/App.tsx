import { useEffect, useContext, useState } from "react";
// eslint-disable-next-line import/no-unassigned-import
import "./teacherTool.css";
import { AppStateContext, AppStateReady } from "./state/appStateContext";
import { usePromise } from "./hooks";
import { makeNotification } from "./utils";
import * as Actions from "./state/actions";
import * as NotificationService from "./services/notificationService";
import { downloadTargetConfigAsync } from "./services/backendRequests";
import { logDebug } from "./services/loggingService";

import { HeaderBar } from "./components/HeaderBar";
import { MainPanel } from "./components/MainPanel";
import { Notifications } from "./components/Notifications";
import { CatalogModal } from "./components/CatalogModal";

import { postNotification } from "./transforms/postNotification";
import { loadCatalogAsync } from "./transforms/loadCatalogAsync";

export const App = () => {
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

                // Load criteria catalog
                await loadCatalogAsync();

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
        <>
            <HeaderBar />
            <MainPanel />
            <CatalogModal />
            <Notifications />
        </>
    );
};
