import { useCallback, useContext, useEffect, useState } from "react";
import { AppStateContext } from "./state/AppStateContext";
import Loading from "./components/Loading";
import SignedOutPage from "./components/SignedOutPage";
import SignedInPage from "./components/SignedInPage";
import HeaderBar from "./components/HeaderBar";
import Toast from "./components/Toast";
import AppModal from "./components/AppModal";
import * as authClient from "./services/authClient";
import { setDeepLinks } from "./state/actions";
import { cleanupJoinCode, cleanupShareCode } from "./util";
import { joinGameAsync, hostGameAsync } from "./epics";

// eslint-disable-next-line import/no-unassigned-import
import "./App.css";

function App() {
    const { state, dispatch } = useContext(AppStateContext);
    const { authStatus, deepLinks } = state;
    const { shareCode, joinCode } = deepLinks;
    const [authCheckComplete, setAuthCheckComplete] = useState(false);

    useEffect(() => {
        // On mount, check if user is signed in
        authClient
            .authCheckAsync()
            .then(() => setAuthCheckComplete(true))
            .catch(() => setAuthCheckComplete(true));
    }, [setAuthCheckComplete]);

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
        dispatch(setDeepLinks(shareCodeParam, joinCodeParam));
    }, [dispatch]);

    useEffect(() => {
        // Once we know the user's auth status, parse the URL
        if (authCheckComplete) {
            parseUrlParams();
        }
    }, [authCheckComplete, parseUrlParams]);

    useEffect(() => {
        if (authCheckComplete && (shareCode || joinCode)) {
            // If the user is signed in, follow the deep links
            if (authStatus === "signed-in") {
                if (shareCode) {
                    hostGameAsync(shareCode)
                        .then(() => {})
                        .catch(() => {});
                } else if (joinCode) {
                    joinGameAsync(joinCode)
                        .then(() => {})
                        .catch(() => {});
                }
                // Clear the deep links
                dispatch(setDeepLinks(undefined, undefined));
            }
        }
    }, [dispatch, authStatus, shareCode, joinCode, authCheckComplete]);

    return (
        <div className={`${pxt.appTarget.id} tw-flex tw-flex-col`}>
            {!authCheckComplete && <Loading />}
            {authCheckComplete && (
                <>
                    <HeaderBar />
                    {authStatus === "signed-out" && <SignedOutPage />}
                    {authStatus === "signed-in" && <SignedInPage />}
                </>
            )}
            <AppModal />
            <Toast />
        </div>
    );
}

export default App;
