import { useCallback, useContext, useMemo, useState } from "react"
import { AppStateContext } from "../state/Context"


// eslint-disable-next-line import/no-unassigned-import
import "../App.css"
// eslint-disable-next-line import/no-unassigned-import
import "../arcade.css"

export default function Render() {
    const { state, dispatch } = useContext(AppStateContext)
    const { gameStatus } = state

    return (
        <div>
            {gameStatus === "init" && <></>}
            {gameStatus === "joining" && <></>}
            {gameStatus === "playing" && <></>}
            {gameStatus === "finished" && <></>}
        </div>
    )
}
