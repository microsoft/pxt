import * as gameClient from "../services/gameClient"
import { dispatch } from "./Context"
import { setGameMode, setGameStatus, setGameInfo, setErrorMessage, clearErrorMessage } from "./actions"

/*
* "Processes" are functions that modify the state of the app in complex ways over a period of time.
*/

export async function hostGameAsync(shareCode: string) {
    try {
        dispatch(setGameMode("host"))
        dispatch(setGameStatus("joining"))

        const gameInfo = await gameClient.hostGameAsync(shareCode)
        
        dispatch(setGameInfo(gameInfo))
        dispatch(setGameStatus("playing"))

    } catch (e) {
        console.log("error", e)
        dispatch(setGameStatus("init"))
        showErrorMessage(lf("Something went wrong. Please try again."))
    } finally {
    }
}

export async function joinGameAsync(joinCode: string) {
    try {
    } catch (e) {
    } finally {
    }
}

let errorTimeout: any

export function showErrorMessage(message: string) {
    dispatch(setErrorMessage(message))
    clearTimeout(errorTimeout)
    errorTimeout = setTimeout(() => dispatch(clearErrorMessage()), 5000)
}
