import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AppStateContext } from "./state/AppStateContext";
import { SignInModal } from "../../react-common/components/profile/SignInModal";
import { signInAsync, signOutAsync } from "./epics";
import Loading from "./components/Loading";
import SignInPage from "./components/SignInPage";
import SignedInPage from "./components/SignedInPage";
import HeaderBar from "./components/HeaderBar"
import Toast from "./components/Toast";
import AppModal from "./components/AppModal";
import * as authClient from "./services/authClient";

// eslint-disable-next-line import/no-unassigned-import
import "./App.css";

function App() {
    const { state } = useContext(AppStateContext);
    const { signedIn, appMode } = state;
    const { uiMode } = appMode;
    const [showSignInModal, setShowSignInModal] = useState(false);

    const loading = useMemo(() => uiMode === "init", [uiMode]);

    const handleSignIn = useCallback(async () => {
        setShowSignInModal(true);
    }, [signedIn, setShowSignInModal]);

    const handleSignOut = useCallback(async () => {
        await signOutAsync();
    }, [signedIn]);

    useEffect(() => {
        // On mount, check if user is signed in
        authClient
            .authCheckAsync()
            .then(() => {})
            .catch(() => {});
    }, []);

    return (
        <div className={`${pxt.appTarget.id}`}>
            <HeaderBar handleSignOut={handleSignOut} />
            {loading && <Loading />}
            {!loading && !signedIn && <SignInPage />}
            {!loading && signedIn && <SignedInPage handleSignOut={handleSignOut}/>}
            <AppModal />
            <Toast />
        </div>
    );
}

export default App;
