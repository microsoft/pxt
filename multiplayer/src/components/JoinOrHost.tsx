import { useCallback, useContext, useMemo, useState } from "react"
import { AppStateContext } from "../state/AppStateContext"
import { setUiMode } from "../state/actions"
import { Button } from "../../../react-common/components/controls/Button"

export default function Render() {
    const { dispatch } = useContext(AppStateContext)

    return (
        <div>
            <Button
                label={lf("Host Game")}
                title={lf("Host Game")}
                onClick={() => dispatch(setUiMode("host"))}
            />
            <Button
                label={lf("Join Game")}
                title={lf("Join Game")}
                onClick={() => dispatch(setUiMode("join"))}
            />
        </div>
    )
}
