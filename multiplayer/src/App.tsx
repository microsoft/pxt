import { useCallback, useContext, useMemo, useState } from "react";
import { AppStateContext } from "./state/AppStateContext";
import { SignInModal } from "../../react-common/components/profile/SignInModal";
import { signInAsync } from "./epics";
import * as authClient from "./services/authClient";
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

    const handleSignInClick = useCallback(async () => {
        setShowSignInModal(true);
    }, [signedIn, setShowSignInModal]);

    return (
        <div className={`${pxt.appTarget.id}`}>
            <HeaderBar signedIn={signedIn} handleSignIn={handleSignInClick} profile={state.profile}/>
            {!signedIn && <SignInPage handleSignIn={handleSignInClick} />}
            {signedIn && <SignedInPage />}
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
