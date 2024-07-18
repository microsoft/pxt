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
import { tryLoadLastActiveChecklistAsync } from "./transforms/tryLoadLastActiveChecklistAsync";
import { ImportChecklistModal } from "./components/ImportChecklistModal";
import { ConfirmationModal } from "./components/ConfirmationModal";
import { BlockPickerModal } from "./components/BlockPickerModal";
import { ScreenReaderAnnouncer } from "./components/ScreenReaderAnnouncer";
import { SignInModal } from "./components/SignInModal";
import * as authClient from "./services/authClient";

export const App = () => {
    const { state, dispatch } = useContext(AppStateContext);
    const [inited, setInited] = useState(false);
    const [authCheckComplete, setAuthCheckComplete] = useState(false); // TODO thsparks : do we need this?

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
                await tryLoadLastActiveChecklistAsync();

                setInited(true);
                logDebug("App initialized");
            });
        }
    }, [ready, inited]);

    useEffect(() => {
        // On mount, check if user is signed in
        authClient
            .authCheckAsync()
            .then(() => setAuthCheckComplete(true))
            .catch(() => setAuthCheckComplete(true));
    }, [setAuthCheckComplete]);

    return !inited ? (
        <div className="ui active dimmer">
            <div className="ui large main loader msft"></div>
        </div>
    ) : (
        <>
            <HeaderBar />
            {state.userProfile && <MainPanel />}
            {authCheckComplete && <SignInModal />}
            <ImportChecklistModal />
            <ConfirmationModal />
            <BlockPickerModal />
            <Toasts />
            <ScreenReaderAnnouncer />
        </>
    );
};
