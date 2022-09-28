import { useCallback, useContext, useMemo, useState } from "react";
import { AppStateContext } from "./state/Context";
import SignInPage from "./components/SignInContainer";
import SignedInPage from "./components/SignedInContainer";

// eslint-disable-next-line import/no-unassigned-import
import "./App.css";
// eslint-disable-next-line import/no-unassigned-import
import "./arcade.css";

function App() {
    const { state, dispatch } = useContext(AppStateContext);
    const { signedIn } = state;

    return (
        <div className={`app-container ${pxt.appTarget.id}`}>
            {!signedIn && <SignInPage />}
            {signedIn && <SignedInPage />}
        </div>
    );
}

export default App;
