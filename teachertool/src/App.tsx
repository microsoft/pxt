import { useEffect, useContext, useState } from "react";
import { AppStateContext, AppStateReady } from "./state/appStateContext";
import { usePromise } from "./hooks/usePromise";
import * as Actions from "./state/actions";
import { downloadTargetConfigAsync } from "./services/backendRequests";
import { logDebug, logError } from "./services/loggingService";
import { HeaderBar } from "./components/HeaderBar";
import { MainPanel } from "./components/MainPanel";
import { Toasts } from "./components/Toasts";
import { loadCatalogAsync } from "./transforms/loadCatalogAsync";
import { loadValidatorPlansAsync } from "./transforms/loadValidatorPlansAsync";
import { tryLoadLastActiveChecklistAsync } from "./transforms/tryLoadLastActiveChecklistAsync";
import { ImportChecklistModal } from "./components/ImportChecklistModal";
import { ConfirmationModal } from "./components/ConfirmationModal";
import { BlockPickerModal } from "./components/BlockPickerModal";
import { ScreenReaderAnnouncer } from "./components/ScreenReaderAnnouncer";
import { SignInModal } from "./components/SignInModal";
import { SignedOutPanel } from "./components/SignedOutPanel";
import * as authClient from "./services/authClient";
import { ErrorCode } from "./types/errorCode";
import { loadProjectMetadataAsync } from "./transforms/loadProjectMetadataAsync";
import { Constants, Ticks } from "./constants";
import { UnsupportedExperienceModal } from "react-common/components/experiences/UnsupportedExperienceModal";
import { ThemeManager } from "react-common/components/theming/themeManager";

export const App = () => {
    const { state, dispatch } = useContext(AppStateContext);
    const [inited, setInited] = useState(false);
    const [authCheckComplete, setAuthCheckComplete] = useState(false);
    const [isSupported, setIsSupported] = useState<Boolean | undefined>(undefined);

    const ready = usePromise(AppStateReady, false);

    useEffect(() => {
        if (ready && !inited) {
            Promise.resolve().then(async () => {
                const cfg = await downloadTargetConfigAsync();
                dispatch(Actions.setTargetConfig(cfg || {}));
                pxt.BrowserUtils.initTheme();
                await initColorThemeAsync();

                // Load catalog and validator plans into state.
                await loadCatalogAsync();
                await loadValidatorPlansAsync();
                await tryLoadLastActiveChecklistAsync();

                setInited(true);

                // Check if a project was specified on the URL and load it if so.
                const projectParam = window.location.href.match(/project=([^&]+)/)?.[1];
                if (!!projectParam) {
                    const decoded = decodeURIComponent(projectParam);
                    const shareId = pxt.Cloud.parseScriptId(decoded);
                    if (!!shareId) {
                        pxt.tickEvent(Ticks.LoadProjectFromUrl);
                        await loadProjectMetadataAsync(decoded, shareId);
                    }
                }

                logDebug("App initialized");
            });
        }
    }, [ready, inited]);

    useEffect(() => {
        async function checkAuthAsync() {
            // On mount, check if user is signed in
            try {
                await authClient.authCheckAsync();
            } catch (e) {
                // Log error but continue
                // Don't include actual error in error log in case PII
                logError(ErrorCode.authCheckFailed);
                logDebug("Auth check failed details", e);
            }
            setAuthCheckComplete(true);
        }
        checkAuthAsync();
    }, []);

    useEffect(() => {
        setIsSupported(pxt.U.isExperienceSupported(Constants.ExperienceId));
    }, []);

    async function initColorThemeAsync() {
        // We don't currently support switching themes in multiplayer, so just load the default.
        const themeId = pxt.appTarget?.appTheme?.defaultColorTheme;

        if (themeId) {
            const themeManager = ThemeManager.getInstance(document);
            if (themeId !== themeManager.getCurrentColorTheme()?.id) {
                themeManager.switchColorTheme(themeId);
            }
        }
    }

    return !inited || !authCheckComplete ? (
        <div className="ui active dimmer">
            <div className="ui large main loader msft"></div>
        </div>
    ) : isSupported ? (
        <>
            <HeaderBar />
            {state.userProfile ? <MainPanel /> : <SignedOutPanel />}
            <SignInModal />
            <ImportChecklistModal />
            <ConfirmationModal />
            <BlockPickerModal />
            <Toasts />
            <ScreenReaderAnnouncer />
        </>
    ) : (
        <UnsupportedExperienceModal />
    );
};
