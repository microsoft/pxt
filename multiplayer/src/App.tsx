import { useCallback, useContext, useMemo, useState } from "react"
import { AppStateContext } from "./state/AppStateContext"
import SignInPage from "./components/SignInPage"
import SignedInPage from "./components/SignedInPage"
import Toast from "./components/Toast"

// eslint-disable-next-line import/no-unassigned-import
import "./App.css"

function App() {
    const { state } = useContext(AppStateContext)
    const { signedIn } = state

    return (
        <div className={`${pxt.appTarget.id}`}>
            {!signedIn && <SignInPage />}
            {signedIn && <SignedInPage />}
            <Toast />
        </div>
    )
}

export default App
