import { useCallback, useContext, useMemo, useState } from "react"
import { AppStateContext } from "../state/Context"
import { Button } from "../../../react-common/components/controls/Button"
import * as authClient from "../services/authClient"
import SelectGameMode from "./SelectGameMode"
import HostGame from "./HostGame"
import JoinGame from "./JoinGame"

// eslint-disable-next-line import/no-unassigned-import
import "../App.css"
// eslint-disable-next-line import/no-unassigned-import
import "../arcade.css"

export default function Render() {
    const { state, dispatch } = useContext(AppStateContext)
    const { signedIn, gameMode } = state

    const handleSignOutClick = useCallback(async () => {
        await authClient.logoutAsync()
    }, [signedIn])

    const authButtonLabel = lf("Sign Out")

    return (
        <div className="app-content">
            <Button
                className='auth-button primary'
                label={authButtonLabel}
                title={authButtonLabel}
                onClick={handleSignOutClick}
            />
            {gameMode === "none" && <SelectGameMode />}
            {gameMode === "host" && <HostGame />}
            {gameMode === "join" && <JoinGame />}
        </div>
    )
}
