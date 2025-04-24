import css from "./App.module.scss";
import { useCallback, useContext, useEffect, useState } from "react";
import { AppStateContext } from "@/state/Context";
import { Loading } from "@/components/Loading";
import { SignedOutPage } from "@/components/SignedOutPage";
import { SignedInPage } from "@/components/SignedInPage";
import { HeaderBar } from "@/components/HeaderBar";
import { SignInModal } from "@/components/SignInModal";
import { Toaster } from "@/components/Toaster";
import * as authClient from "@/services/authClient";
import { classlist, cleanupJoinCode, cleanupShareCode } from "@/utils";
import { ThemeManager } from "react-common/components/theming/themeManager";

function App() {
    const { state, dispatch } = useContext(AppStateContext);
    const { authStatus } = state;
    const [authCheckComplete, setAuthCheckComplete] = useState(false);

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
    });

    //useVisibilityChange(visibilityChanged);

    useEffect(() => {
        // On mount, check if user is signed in
        authClient
            .authCheckAsync()
            .then(() => setAuthCheckComplete(true))
            .catch(() => setAuthCheckComplete(true));
    }, [setAuthCheckComplete]);

    useEffect(() => {
        // We don't currently support switching themes in mmo, so just load the default.
        const themeId = pxt.appTarget?.appTheme?.defaultColorTheme;
        if (themeId) {
            const themeManager = ThemeManager.getInstance(document);
            if (themeId !== themeManager.getCurrentColorTheme()?.id) {
                themeManager.switchColorTheme(themeId);
            }
        }
    }, []);

    const parseUrlParams = useCallback(() => {
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
    }, [dispatch]);

    useEffect(() => {
        // Once we know the user's auth status, parse the URL
        if (authCheckComplete) {
            parseUrlParams();
        }
    }, [authCheckComplete, parseUrlParams]);

    /*
    useEffect(() => {
        if (authCheckComplete && (shareCode || joinCode)) {
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
    }, [dispatch, authStatus, shareCode, joinCode, authCheckComplete]);
    */
    return (
        <div className={classlist(`${pxt.appTarget.id}`, css["app"])}>
            {!authCheckComplete && <Loading />}
            {authCheckComplete && (
                <>
                    <HeaderBar />
                    {authStatus === "signed-out" && <SignedOutPage />}
                    {authStatus === "signed-in" && <SignedInPage />}
                </>
            )}
            <SignInModal />
            <Toaster />
        </div>
    );
}

export default App;
