import * as gameClient from "../services/gameClient"
import { dispatch } from "../state"
import { clearGameInfo } from "../state/actions"

export async function leaveGameAsync() {
    await gameClient.leaveGameAsync()
    dispatch(clearGameInfo())
}
