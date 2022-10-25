import { useCallback, useContext, useEffect, useState } from "react";
import { AppStateContext } from "./state/AppStateContext";
import Loading from "./components/Loading";
import SignInPage from "./components/SignInPage";
import SignedInPage from "./components/SignedInPage";
import HeaderBar from "./components/HeaderBar";
import Toast from "./components/Toast";
import AppModal from "./components/AppModal";
import Footer from "./components/Footer";
import * as authClient from "./services/authClient";
import { setDeepLinks, showModal } from "./state/actions";
import { cleanupJoinCode } from "./util";
import { joinGameAsync, hostGameAsync } from "./epics";
import { useAuthDialogMessages } from "./hooks/useAuthDialogMessages";

// eslint-disable-next-line import/no-unassigned-import
import "./App.css";

function App() {
    const { state, dispatch } = useContext(AppStateContext);
    const { authStatus, deepLinks } = state;
    const { shareCode, joinCode } = deepLinks;
    const [authCheckComplete, setAuthCheckComplete] = useState(false);

    const dialogMessages = useAuthDialogMessages();

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
            // After sign in, the params are in the hash. I think this is a bug in pxt.auth
            params = new URLSearchParams(window.location.hash.substr(1));
        } else {
            params = new URLSearchParams(window.location.search);
        }
        let shareCodeParam = params.get("host") ?? undefined;
        let joinCodeParam = params.get("join") ?? undefined;
        shareCodeParam = pxt.Cloud.parseScriptId(shareCodeParam ?? "");
        joinCodeParam = cleanupJoinCode(joinCodeParam ?? "");
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
            } else if (authStatus === "signed-out") {
                dispatch(showModal("sign-in", { dialogMessages }));
            }
        }
    }, [dispatch, authStatus, shareCode, joinCode, authCheckComplete]);

    return (
        <div className={`${pxt.appTarget.id} tw-flex tw-flex-col`}>
            {!authCheckComplete && <Loading />}
            {authCheckComplete && (
                <>
                    <HeaderBar />
                    {authStatus === "signed-out" && <SignInPage />}
                    {authStatus === "signed-in" && <SignedInPage />}
                </>
            )}
            <AppModal />
            <Toast />
            <div className="tw-flex-grow" />
            <Footer />
        </div>
    );
}

export default App;
