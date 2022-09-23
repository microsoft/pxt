import { useCallback, useContext, useMemo, useState } from "react";
import { AppStateContext } from "./state/Context";
import { setMotd } from "./state/actions";
import * as authClient from "./services/authClient";
import { Button } from "../../react-common/components/controls/Button";
import { SignInModal } from "../../react-common/components/profile/SignInModal";

// eslint-disable-next-line import/no-unassigned-import
import "./App.css";
// eslint-disable-next-line import/no-unassigned-import
import "./arcade.css";

function App() {
    const { state, dispatch } = useContext(AppStateContext);
    const { motd, signedIn, profile } = state;

    const [showSignInModal, setShowSignInModal] = useState(false);

    const updateMotd = useCallback(() => {
        if (motd.includes("Hello")) {
            dispatch(setMotd("Goodnight, Moon."));
        } else {
            dispatch(setMotd("Hello, World!"));
        }
    }, [motd, dispatch]);

    const handleSignInClick = useCallback(async () => {
        if (signedIn) {
            await authClient.logoutAsync();
        } else {
            setShowSignInModal(true);
        }
    }, [signedIn, setShowSignInModal]);

    const authButtonLabel = useMemo(() => (signedIn ? lf("Sign Out") : lf("Sign In")), [signedIn]);

    return (
        <div className={`app-container ${pxt.appTarget.id}`}>
            <div className='app-content'>
                <div className='content-row'>
                    <div>{signedIn && lf("Signed In {0}", profile?.idp?.username)}</div>
                    <Button
                        className='auth-button primary'
                        label={authButtonLabel}
                        title={authButtonLabel}
                        onClick={handleSignInClick}
                    />
                </div>
                <div className='content-row'>
                    <div>{motd}</div>
                    <Button
                        className='motd-button teal inverted'
                        label={lf("Update MOTD")}
                        title={lf("Update MOTD")}
                        onClick={updateMotd}
                    />
                </div>
            </div>
            {showSignInModal && (
                <SignInModal
                    onClose={() => setShowSignInModal(false)}
                    onSignIn={async (provider, rememberMe) => {
                        authClient.loginAsync(provider.id, rememberMe);
                    }}
                />
            )}
        </div>
    );
}

export default App;
