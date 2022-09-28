import { useCallback, useContext, useMemo, useState } from "react"
import { AppStateContext } from "../state/Context"
import { setGameMode } from "../state/actions"
import { Button } from "../../../react-common/components/controls/Button"

// eslint-disable-next-line import/no-unassigned-import
import "../App.css"
// eslint-disable-next-line import/no-unassigned-import
import "../arcade.css"

export default function Render() {
    const { state, dispatch } = useContext(AppStateContext)

    return (
        <div>
            <Button
                label={lf('Host Game')}
                title={lf('Host Game')}
                onClick={() => dispatch(setGameMode("host"))}
            />
            <Button
                label={lf('Join Game')}
                title={lf('Join Game')}
                onClick={() => dispatch(setGameMode("join"))}
            />
        </div>
    )
}
