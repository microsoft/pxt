import { useEffect, useContext, useState } from "react";
import { AppStateContext, AppStateReady } from "./state/appStateContext";
import { usePromise } from "./hooks/usePromise";
import { downloadTargetConfigAsync } from "pxtservices/backendRequests";
import { logDebug } from "pxtservices/loggingService";
import { HeaderBar } from "./components/HeaderBar";
import { setTargetConfig } from "./state/actions";
import { EditorPanel } from "./components/EditorPanel";
import { authCheckAsync } from "./services/authClient";
import { ThemeManager } from "react-common/components/theming/themeManager";
import { setCurrentFrameTheme } from "./transforms/setCurrentFrameTheme";

export const App = () => {
    const { state, dispatch } = useContext(AppStateContext);
    const [inited, setInited] = useState(false);

    const ready = usePromise(AppStateReady, false);

    useEffect(() => {
        if (ready && !inited) {
            (async () => {
                logDebug("App is ready, initializing...");

                // Handle login callbacks
                await authCheckAsync();

                const cfg = await downloadTargetConfigAsync();
                dispatch(setTargetConfig(cfg || {}));
                pxt.BrowserUtils.initTheme();


                setInited(true);
                logDebug("App initialized");
            })();
        }
    }, [ready, inited]);

    useEffect(() => {
        // We don't currently support switching themes in multiplayer, so just load the default.
        const themeId = pxt.appTarget?.appTheme?.defaultColorTheme;
        if (themeId) {
            const themeManager = ThemeManager.getInstance(document);
            if (themeId !== themeManager.getCurrentColorTheme()?.id) {
                themeManager.switchColorTheme(themeId);
            }

            if (ready && inited) {
                // This is here just in case this finishes after initialization is complete.
                // The useEffect that normally sets this will have already run and won't have had the theme.
                setCurrentFrameTheme(themeManager.getCurrentColorTheme());
            }
        }
    }, []);

    useEffect(() => {
        if (ready && inited) {
            // Set initial frame theme to same as the default theme
            const themeManager = ThemeManager.getInstance(document);
            const currentTheme = themeManager.getCurrentColorTheme();
            if (currentTheme) {
                setCurrentFrameTheme(currentTheme);
            }
        }
    }, [ready, inited])

    return !inited ? (
        <div className="ui active dimmer">
            <div className="ui large main loader msft"></div>
        </div>
    ) : (
        <>
            <HeaderBar />
            <EditorPanel />
        </>
    );
};
