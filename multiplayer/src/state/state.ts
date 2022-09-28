import { GameMode, GameStatus, GameInfo } from "../types"

export type AppState = {
    signedIn: boolean
    profile: pxt.auth.UserProfile | undefined
    gameMode: GameMode
    gameId: string | undefined
    gameStatus: GameStatus
    joinCode: string | undefined
    gameInfo: GameInfo | undefined
    errorMessage: string | undefined
}

export const initialAppState: AppState = {
    signedIn: false,
    profile: undefined,
    gameMode: "none",
    gameId: undefined,
    gameStatus: "init",
    joinCode: undefined,
    gameInfo: undefined,
    errorMessage: undefined
}
