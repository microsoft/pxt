import { useCallback, useContext, useMemo, useState } from "react"
import { AppStateContext } from "../state/AppStateContext"
import { signOutAsync } from "../epics"
import { Button } from "../../../react-common/components/controls/Button"
import JoinOrHost from "./JoinOrHost"
import HostGame from "./HostGame"
import JoinGame from "./JoinGame"

export default function Render() {
    const { state } = useContext(AppStateContext)
    const { signedIn, appMode } = state
    const { uiMode } = appMode

    const handleSignOutClick = useCallback(async () => {
        await signOutAsync()
    }, [signedIn])

    const authButtonLabel = lf("Sign Out")

    return (
        <div className="pt-3 pb-8 flex flex-col items-center gap-1 h-screen">
            <Button
                className="primary"
                label={authButtonLabel}
                title={authButtonLabel}
                onClick={handleSignOutClick}
            />
            {uiMode === "home" && <JoinOrHost />}
            {uiMode === "host" && <HostGame />}
            {uiMode === "join" && <JoinGame />}
        </div>
    )
}
