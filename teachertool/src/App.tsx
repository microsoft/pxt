import { useEffect, useContext, useState } from "react";
import { AppStateContext, AppStateReady } from "./state/appStateContext";
import { usePromise } from "./hooks/usePromise";
import { makeToast } from "./utils";
import * as Actions from "./state/actions";
import { downloadTargetConfigAsync } from "./services/backendRequests";
import { logDebug } from "./services/loggingService";
import { HeaderBar } from "./components/HeaderBar";
import { MainPanel } from "./components/MainPanel";
import { Toasts } from "./components/Toasts";
import { showToast } from "./transforms/showToast";
import { loadCatalogAsync } from "./transforms/loadCatalogAsync";
import { loadValidatorPlansAsync } from "./transforms/loadValidatorPlansAsync";
import { tryLoadLastActiveRubricAsync } from "./transforms/tryLoadLastActiveRubricAsync";
import { ImportRubricModal } from "./components/ImportRubricModal";
import { ConfirmationModal } from "./components/ConfirmationModal";
import { BlockPickerModal } from "./components/BlockPickerModal";
import { ScreenReaderAnnouncer } from "./components/ScreenReaderAnnouncer";

export const App = () => {
    const { state, dispatch } = useContext(AppStateContext);
    const [inited, setInited] = useState(false);

    const ready = usePromise(AppStateReady, false);

    useEffect(() => {
        if (ready && !inited) {
            Promise.resolve().then(async () => {
                const cfg = await downloadTargetConfigAsync();
                dispatch(Actions.setTargetConfig(cfg || {}));
                pxt.BrowserUtils.initTheme();

                // Load catalog and validator plans into state.
                await loadCatalogAsync();
                await loadValidatorPlansAsync();
                await tryLoadLastActiveRubricAsync();

                // Test notification
                showToast({
                    ...makeToast("success", "🎓", 2000),
                    hideIcon: true,
                    hideDismissBtn: true,
                    className: "app-large-toast",
                });

                setInited(true);
                logDebug("App initialized");
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
            <ImportRubricModal />
            <ConfirmationModal />
            <BlockPickerModal />
            <Toasts />
            <ScreenReaderAnnouncer />
        </>
    );
};
