import { useCallback, useContext, useRef, useMemo, useState } from "react"
import { AppStateContext } from "../state/Context"
import { hostGameAsync } from "../state/processes"
import { Input } from "../../../react-common/components/controls/Input"
import { Button } from "../../../react-common/components/controls/Button"

// eslint-disable-next-line import/no-unassigned-import
import "../App.css"
// eslint-disable-next-line import/no-unassigned-import
import "../arcade.css"

export default function Render() {
    const { state, dispatch } = useContext(AppStateContext)
    const { gameStatus } = state

    let inputRef = useRef<HTMLInputElement>(null)

    const onStartClick = () => {
        if (inputRef.current) {
            const gameId = inputRef.current.value.trim().split("/").pop()
            if (gameId) {
                hostGameAsync(gameId);
            }
        }
    }

    return (
        <div>
            {gameStatus === "init" && (
                <>
                    <Input
                        label='Game URL or share code'
                        title='Game URL or share code'
                        autoComplete={false}
                        handleInputRef={inputRef}
                        preserveValueOnBlur={true}
                    />
                    <Button label='Start' title='Start' onClick={onStartClick} />
                </>
            )}
            {gameStatus === "joining" && <>"Joining"</>}
            {gameStatus === "playing" && <>"Playing"</>}
            {gameStatus === "finished" && <>"Finished"</>}
        </div>
    )
}
