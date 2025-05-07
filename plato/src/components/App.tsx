import css from "./styling/App.module.scss";
import { useCallback, useContext, useEffect, useState } from "react";
import { AppStateContext, AppStateReady } from "@/state/Context";
import { Loading } from "@/components/Loading";
import { MainPanel } from "@/components/MainPanel";
import { HeaderBar } from "@/components/HeaderBar";
import { SignInModal } from "@/components/SignInModal";
import { Toaster } from "@/components/Toaster";
import * as authClient from "@/services/authClient";
import { cleanupJoinCode, cleanupShareCode } from "@/utils";
import { usePromise } from "@/hooks/usePromise";
import { ThemeManager } from "react-common/components/theming/themeManager";
import { classList } from "react-common/components/util";
import { JoinModal } from "./JoinModal";
import * as transforms from "@/transforms";

function App() {
    const { dispatch } = useContext(AppStateContext);
    const [authCheckComplete, setAuthCheckComplete] = useState(false);

    const ready = usePromise(AppStateReady, false);

    useEffect(() => {
        transforms.init();
    }, []);

    useEffect(() => {
        /*
        if (!targetConfig) {
            // targetConfigAsync ends up at localhost:3000 and cors issues hitting 3232
            const req = pxt.BrowserUtils.isLocalHostDev()
                ? fetch(`/blb/targetconfig.json`, {
                      method: "GET",
                  }).then(resp => resp.json() as pxt.TargetConfig | undefined)
                : pxt.targetConfigAsync();
            req.then(trgcfg => trgcfg && dispatch(setTargetConfig(trgcfg)));
        }
            */
    }, []);

    //useVisibilityChange(visibilityChanged);

    useEffect(() => {
        // On mount, check if user is signed in
        if (ready && !authCheckComplete) {
            // Check if the user is signed in
            authClient
                .authCheckAsync()
                .then(() => setAuthCheckComplete(true))
                .catch(() => setAuthCheckComplete(true));
        }
    }, [ready, authCheckComplete]);

    useEffect(() => {
        // We don't currently support switching themes in plato, so just load the default.
        const themeId = pxt.appTarget?.appTheme?.defaultColorTheme;
        if (themeId) {
            const themeManager = ThemeManager.getInstance(document);
            if (themeId !== themeManager.getCurrentColorTheme()?.id) {
                themeManager.switchColorTheme(themeId);
            }
        }
    }, []);

    const parseUrlParams = useCallback(() => {
        if (ready) {
            let params: URLSearchParams | undefined = undefined;
            if (window.location.hash[1] === "?") {
                // After sign in the params are in the hash. This may be a bug in pxt.auth.
                params = new URLSearchParams(window.location.hash.substr(1));
            } else {
                params = new URLSearchParams(window.location.search);
            }
            let shareCodeParam = params.get("host") ?? undefined;
            let joinCodeParam = params.get("join") ?? undefined;
            shareCodeParam = cleanupShareCode(shareCodeParam);
            joinCodeParam = cleanupJoinCode(joinCodeParam);
            //dispatch(setDeepLinks(shareCodeParam, joinCodeParam));
        }
    }, [ready, dispatch]);

    useEffect(() => {
        // Once we know the user's auth status, parse the URL
        if (ready && authCheckComplete) {
            parseUrlParams();
        }
    }, [ready, authCheckComplete, parseUrlParams]);

    /*
    useEffect(() => {
        if (ready && authCheckComplete && (shareCode || joinCode)) {
            // If the user is signed in, follow the deep links
            if (authStatus === "signed-in") {
                if (shareCode) {
                    hostCollabAsync(shareCode)
                        .then(() => {})
                        .catch(() => {});
                } else if (joinCode) {
                    joinCollabAsync(joinCode)
                        .then(() => {})
                        .catch(() => {});
                }
                // Clear the deep links
                dispatch(setDeepLinks(undefined, undefined));
            }
        }
    }, [ready, dispatch, authStatus, shareCode, joinCode, authCheckComplete]);
    */
    return (
        <div className={classList(`${pxt.appTarget.id}`, css["app"])}>
            {!authCheckComplete && <Loading />}
            {authCheckComplete && (
                <>
                    <HeaderBar />
                    <MainPanel />
                </>
            )}
            <SignInModal />
            <JoinModal />
            <Toaster />
        </div>
    );
}

export default App;
