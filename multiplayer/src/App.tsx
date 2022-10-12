import { useCallback, useContext, useMemo, useState } from "react";
import { AppStateContext } from "./state/AppStateContext";
import { SignInModal } from "../../react-common/components/profile/SignInModal";
import { signInAsync, signOutAsync } from "./epics";
import SignInPage from "./components/SignInPage";
import SignedInPage from "./components/SignedInPage";
import HeaderBar from "./components/HeaderBar"
import Toast from "./components/Toast";

// eslint-disable-next-line import/no-unassigned-import
import "./App.css";

function App() {
    const { state } = useContext(AppStateContext);
    const { signedIn } = state;
    const [showSignInModal, setShowSignInModal] = useState(false);

    const handleSignIn = useCallback(async () => {
        setShowSignInModal(true);
    }, [signedIn, setShowSignInModal]);

    const handleSignOut = useCallback(async () => {
        await signOutAsync();
    }, [signedIn]);

    return (
        <div className={`${pxt.appTarget.id}`}>
            <HeaderBar signedIn={signedIn} handleSignIn={handleSignIn} handleSignOut={handleSignOut} profile={state.profile}/>
            {!signedIn && <SignInPage handleSignIn={handleSignIn} />}
            {signedIn && <SignedInPage handleSignOut={handleSignOut}/>}
            {showSignInModal && (
                <SignInModal
                    onClose={() => setShowSignInModal(false)}
                    onSignIn={async (provider, rememberMe) => {
                        await signInAsync(provider.id, rememberMe);
                    }}
                />
            )}
            <Toast />
        </div>
    );
}

export default App;
