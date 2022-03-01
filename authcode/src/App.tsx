import React from "react";
// eslint-disable-next-line import/no-unassigned-import
import "./App.css";
import { useAppSelector } from "./state/store";
import { authorizeToken, resetTokenStatus } from "./state/slices/auth";
import * as authClient from "./services/auth";
import { useDispatch } from "react-redux";
import { useState } from "react";

function App() {
    const dispatch = useDispatch();
    const { signedIn, profile, tokenStatus } = useAppSelector(state => state.auth);
    const [authBtnEnabled, setAuthBtnEnabled] = useState(false);

    const codeRef = React.useRef<HTMLInputElement | null>(null);

    function handleSignOutClick() {
        authClient.logoutAsync("");
    }

    function handleSignInClick() {
        authClient.loginAsync("microsoft", true);
    }

    function handleAuthorizeTokenClick() {
        dispatch(authorizeToken(codeRef.current?.value));
    }

    function onTextChange(event: React.ChangeEvent<HTMLInputElement>) {
        dispatch(resetTokenStatus());
        const txt = event.target.value.toUpperCase().replace(/[^A-Z0-9]/, "");
        if (codeRef.current) codeRef.current.value = txt;
        const codeLen = codeRef?.current?.value?.length ?? 0;
        setAuthBtnEnabled(signedIn && codeLen === 6);
    }

    const firstName = profile?.idp?.displayName?.split(" ")?.[0];

    return (
        <div className='App'>
            <div className='app-header'>
                <span className='app-name'>{pxt.appTarget.thumbnailName}</span>&nbsp;&nbsp;
                <span>Device Activation</span>
            </div>
            <div className='app-content'>
                {!signedIn && (
                    <div className='user'>
                        <div>Sign in to activate your device</div>
                        <div>
                            <button className='button' onClick={() => handleSignInClick()}>
                                Sign in
                            </button>
                        </div>
                    </div>
                )}
                {signedIn && (
                    <>
                        <div className='user'>
                            {"Hi " + firstName}! Not you?{" "}
                            <button className='button' onClick={() => handleSignOutClick()}>
                                Sign out
                            </button>
                        </div>
                        <div className='code'>
                            <div className='enterCode'>Enter the code from your device</div>
                            <div>
                                <input
                                    type='text'
                                    className='code-input'
                                    autoFocus
                                    maxLength={6}
                                    ref={codeRef}
                                    onChange={event => onTextChange(event)}
                                />
                            </div>
                            <div>
                                <button
                                    className={"button primary-button" + (authBtnEnabled ? "" : " disabled")}
                                    onClick={() => authBtnEnabled && handleAuthorizeTokenClick()}
                                >
                                    Authorize
                                </button>
                            </div>
                        </div>
                        {tokenStatus === "pending" && <div className='token-status pending'>Checking...</div>}
                        {tokenStatus === "invalid" && (
                            <div className='token-status invalid'>Hm, I couldn't find that code. Try again?</div>
                        )}
                        {tokenStatus === "authorized" && (
                            <div className='token-status authorized'>Success! You're now signed in on your device</div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default App;
